import { z } from "zod";
import { EmploymentType, SaleStatus, UserRole } from "@prisma/client";

const optionalString = z.string().trim().optional().or(z.literal(""));

/** "HH:mm" 24-hour. */
const timeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:mm, e.g. 09:00");

export const employeeSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  email: z.string().trim().email("Enter a valid email address"),
  /** Only required when creating; blank on edit leaves the password unchanged. */
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .optional()
    .or(z.literal("")),
  role: z.nativeEnum(UserRole).default("READ_ONLY"),

  employeeNumber: optionalString,
  designation: optionalString,
  department: optionalString,
  employmentType: z.nativeEnum(EmploymentType).default("FULL_TIME"),
  hireDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date")
    .optional()
    .or(z.literal("")),

  baseSalary: z.coerce
    .number({ invalid_type_error: "Enter a number" })
    .min(0, "Must be zero or more"),
  currency: z.string().trim().min(3).max(3).default("PKR"),
  commissionRate: z.coerce
    .number({ invalid_type_error: "Enter a number" })
    .min(0, "Must be zero or more")
    .max(100, "Cannot exceed 100%")
    .default(0),

  shiftStart: timeString.default("09:00"),
  shiftEnd: timeString.default("18:00"),

  workingDaysOverride: z
    .union([z.coerce.number().int().min(1).max(31), z.literal("")])
    .optional(),

  phone: optionalString,
});

export type EmployeeFormValues = z.input<typeof employeeSchema>;

export const saleSchema = z.object({
  description: z.string().trim().min(2, "Describe the sale").max(300),
  saleDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date"),
  amount: z.coerce
    .number({ invalid_type_error: "Enter a number" })
    .positive("Amount must be greater than zero"),
  currency: z.string().trim().min(3).max(3).default("USD"),
  /** Units of payroll currency per 1 unit of `currency`. */
  exchangeRate: z.coerce
    .number({ invalid_type_error: "Enter a number" })
    .positive("Exchange rate must be greater than zero"),
  clientId: optionalString,
});

export type SaleFormValues = z.input<typeof saleSchema>;

export const saleStatusSchema = z.nativeEnum(SaleStatus);

export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PAID: "Paid",
};

export const SALE_STATUS_VARIANT: Record<
  SaleStatus,
  "muted" | "success" | "danger" | "info"
> = {
  PENDING: "muted",
  APPROVED: "success",
  REJECTED: "danger",
  PAID: "info",
};

export const ATTENDANCE_LABELS = {
  PRESENT: "Present",
  LATE: "Late",
  HALF_DAY: "Half day",
  ABSENT: "Absent",
  ON_LEAVE: "On leave",
  HOLIDAY: "Holiday",
  WEEKEND: "Weekend",
} as const;

export const ATTENDANCE_VARIANT = {
  PRESENT: "success",
  LATE: "warning",
  HALF_DAY: "warning",
  ABSENT: "danger",
  ON_LEAVE: "info",
  HOLIDAY: "muted",
  WEEKEND: "muted",
} as const;
