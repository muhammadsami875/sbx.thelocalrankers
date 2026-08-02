"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma, notDeleted } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { minutesBetween, resolveClockInStatus } from "@/lib/payroll";
import { todayDateOnly } from "@/lib/date-only";

export type AttendanceResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

/**
 * Today as a date-only value. Attendance.date is a Postgres `date`, which is
 * truncated to its UTC part — so local midnight would be stored as the
 * previous day anywhere east of UTC. See lib/date-only.ts.
 */
const today = todayDateOnly;

async function currentEmployee(userId: string) {
  return prisma.employee.findFirst({
    where: { userId, ...notDeleted },
    select: {
      id: true,
      shiftStart: true,
      shiftEnd: true,
      user: { select: { name: true } },
    },
  });
}

async function clientIp(): Promise<string | null> {
  try {
    const h = await headers();
    return (
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      h.get("x-real-ip") ??
      null
    );
  } catch {
    return null;
  }
}

/** Marks the caller present for today. */
export async function clockIn(): Promise<AttendanceResult> {
  try {
    const session = await requireSession();
    const employee = await currentEmployee(session.user.id);
    if (!employee) {
      return {
        ok: false,
        error: "No employee record is linked to your account. Ask an admin to set one up.",
      };
    }

    const date = today();

    const existing = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId: employee.id, date } },
      select: { id: true, clockIn: true },
    });
    if (existing?.clockIn) {
      return { ok: false, error: "You have already clocked in today." };
    }

    const now = new Date();
    const { status, lateMinutes } = resolveClockInStatus(now, employee.shiftStart);

    // Upsert covers the case where an admin pre-marked the day (e.g. ON_LEAVE)
    // and the employee then actually turns up.
    await prisma.attendance.upsert({
      where: { employeeId_date: { employeeId: employee.id, date } },
      create: {
        employeeId: employee.id,
        date,
        clockIn: now,
        status,
        lateMinutes,
        ipAddress: await clientIp(),
      },
      update: {
        clockIn: now,
        status,
        lateMinutes,
        ipAddress: await clientIp(),
      },
    });

    await recordAudit({
      userId: session.user.id,
      action: "CREATE",
      entity: "Attendance",
      summary:
        status === "LATE"
          ? `clocked in ${lateMinutes} min late`
          : "clocked in on time",
    });

    revalidatePath("/attendance");
    revalidatePath("/dashboard");

    return {
      ok: true,
      message:
        status === "LATE"
          ? `Clocked in — ${lateMinutes} minute${lateMinutes === 1 ? "" : "s"} late.`
          : "Clocked in. Have a good shift.",
    };
  } catch (error) {
    return handle(error);
  }
}

/** Closes today's shift and records minutes worked. */
export async function clockOut(): Promise<AttendanceResult> {
  try {
    const session = await requireSession();
    const employee = await currentEmployee(session.user.id);
    if (!employee) {
      return { ok: false, error: "No employee record is linked to your account." };
    }

    const date = today();
    const record = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId: employee.id, date } },
      select: { id: true, clockIn: true, clockOut: true },
    });

    if (!record?.clockIn) {
      return { ok: false, error: "You haven't clocked in today yet." };
    }
    if (record.clockOut) {
      return { ok: false, error: "You have already clocked out today." };
    }

    const now = new Date();
    const minutes = minutesBetween(record.clockIn, now);

    await prisma.attendance.update({
      where: { id: record.id },
      data: { clockOut: now, minutesWorked: minutes },
    });

    await recordAudit({
      userId: session.user.id,
      action: "UPDATE",
      entity: "Attendance",
      entityId: record.id,
      summary: `clocked out after ${Math.floor(minutes / 60)}h ${minutes % 60}m`,
    });

    revalidatePath("/attendance");
    revalidatePath("/dashboard");

    return {
      ok: true,
      message: `Clocked out — ${Math.floor(minutes / 60)}h ${minutes % 60}m recorded.`,
    };
  } catch (error) {
    return handle(error);
  }
}

function handle(error: unknown): AttendanceResult {
  if (error instanceof Error && error.message === "UNAUTHENTICATED") {
    return { ok: false, error: "Your session expired. Please sign in again." };
  }
  console.error("[attendance] action failed", error);
  return { ok: false, error: "Something went wrong. Please try again." };
}
