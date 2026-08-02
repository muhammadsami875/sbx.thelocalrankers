"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma, notDeleted } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { requirePermission, PermissionError } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";
import { employeeSchema, type EmployeeFormValues } from "@/lib/validations/hr";

export type EmployeeResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function toDate(value: unknown) {
  if (!value || typeof value !== "string") return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Creates a login and its employee record together.
 *
 * Both live in one transaction — an employee row with no user cannot sign in
 * to clock attendance, and a user with no employee row has nothing to clock
 * against, so a half-created pair is useless either way.
 */
export async function createEmployee(
  values: EmployeeFormValues,
): Promise<EmployeeResult> {
  try {
    const session = await requireSession();
    requirePermission(session.user.role, "employees:create");

    const parsed = employeeSchema.safeParse(values);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Please correct the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const data = parsed.data;
    const email = data.email.toLowerCase();

    if (!data.password) {
      return {
        ok: false,
        error: "A password is required for a new employee.",
        fieldErrors: { password: ["Set an initial password"] },
      };
    }

    const clash = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (clash) {
      return {
        ok: false,
        error: "That email is already in use.",
        fieldErrors: { email: ["Already registered"] },
      };
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const employee = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: data.name,
          email,
          passwordHash,
          role: data.role,
          status: "ACTIVE",
          emailVerified: new Date(),
          jobTitle: data.designation || null,
          phone: data.phone || null,
        },
        select: { id: true },
      });

      return tx.employee.create({
        data: {
          userId: user.id,
          employeeNumber: data.employeeNumber || null,
          designation: data.designation || null,
          department: data.department || null,
          employmentType: data.employmentType,
          hireDate: toDate(data.hireDate),
          baseSalary: new Prisma.Decimal(data.baseSalary),
          salary: new Prisma.Decimal(data.baseSalary),
          currency: data.currency.toUpperCase(),
          commissionRate: new Prisma.Decimal(data.commissionRate),
          shiftStart: data.shiftStart,
          shiftEnd: data.shiftEnd,
          workingDaysOverride:
            data.workingDaysOverride === "" || data.workingDaysOverride == null
              ? null
              : Number(data.workingDaysOverride),
        },
        select: { id: true },
      });
    });

    await recordAudit({
      userId: session.user.id,
      action: "CREATE",
      entity: "Employee",
      entityId: employee.id,
      summary: `created employee ${data.name} (${data.designation || data.role})`,
    });

    revalidatePath("/employees");
    return { ok: true, id: employee.id };
  } catch (error) {
    return handle(error);
  }
}

export async function updateEmployee(
  id: string,
  values: EmployeeFormValues,
): Promise<EmployeeResult> {
  try {
    const session = await requireSession();
    requirePermission(session.user.role, "employees:update");

    const parsed = employeeSchema.safeParse(values);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Please correct the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const before = await prisma.employee.findFirst({
      where: { id, ...notDeleted },
      select: { id: true, userId: true, baseSalary: true, commissionRate: true },
    });
    if (!before) return { ok: false, error: "That employee no longer exists." };

    const data = parsed.data;
    const email = data.email.toLowerCase();

    const clash = await prisma.user.findFirst({
      where: { email, id: { not: before.userId } },
      select: { id: true },
    });
    if (clash) {
      return {
        ok: false,
        error: "That email belongs to another account.",
        fieldErrors: { email: ["Already registered"] },
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: before.userId },
        data: {
          name: data.name,
          email,
          role: data.role,
          jobTitle: data.designation || null,
          phone: data.phone || null,
          // Blank password field means "leave it alone".
          ...(data.password
            ? { passwordHash: await bcrypt.hash(data.password, 12) }
            : {}),
        },
      });

      await tx.employee.update({
        where: { id },
        data: {
          employeeNumber: data.employeeNumber || null,
          designation: data.designation || null,
          department: data.department || null,
          employmentType: data.employmentType,
          hireDate: toDate(data.hireDate),
          baseSalary: new Prisma.Decimal(data.baseSalary),
          salary: new Prisma.Decimal(data.baseSalary),
          currency: data.currency.toUpperCase(),
          commissionRate: new Prisma.Decimal(data.commissionRate),
          shiftStart: data.shiftStart,
          shiftEnd: data.shiftEnd,
          workingDaysOverride:
            data.workingDaysOverride === "" || data.workingDaysOverride == null
              ? null
              : Number(data.workingDaysOverride),
        },
      });
    });

    await recordAudit({
      userId: session.user.id,
      action: "UPDATE",
      entity: "Employee",
      entityId: id,
      summary: `updated employee ${data.name}`,
      before: {
        baseSalary: Number(before.baseSalary ?? 0),
        commissionRate: Number(before.commissionRate),
      },
      after: {
        baseSalary: data.baseSalary,
        commissionRate: data.commissionRate,
      },
    });

    revalidatePath("/employees");
    revalidatePath("/payroll");
    return { ok: true, id };
  } catch (error) {
    return handle(error);
  }
}

/** Soft-deletes the employee record and deactivates the login. */
export async function deactivateEmployee(id: string): Promise<EmployeeResult> {
  try {
    const session = await requireSession();
    requirePermission(session.user.role, "employees:delete");

    const employee = await prisma.employee.findFirst({
      where: { id, ...notDeleted },
      select: { id: true, userId: true, user: { select: { name: true } } },
    });
    if (!employee) return { ok: false, error: "That employee no longer exists." };

    await prisma.$transaction([
      prisma.employee.update({
        where: { id },
        data: { deletedAt: new Date(), terminationDate: new Date() },
      }),
      prisma.user.update({
        where: { id: employee.userId },
        data: { status: "DEACTIVATED" },
      }),
    ]);

    await recordAudit({
      userId: session.user.id,
      action: "DELETE",
      entity: "Employee",
      entityId: id,
      summary: `deactivated employee ${employee.user.name ?? ""}`.trim(),
    });

    revalidatePath("/employees");
    return { ok: true, id };
  } catch (error) {
    return handle(error);
  }
}

function handle(error: unknown): EmployeeResult {
  if (error instanceof PermissionError) {
    return { ok: false, error: "You don't have permission to do that." };
  }
  if (error instanceof Error && error.message === "UNAUTHENTICATED") {
    return { ok: false, error: "Your session expired. Please sign in again." };
  }
  console.error("[employees] action failed", error);
  return { ok: false, error: "Something went wrong. Please try again." };
}
