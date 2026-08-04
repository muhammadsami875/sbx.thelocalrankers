import { z } from "zod";
import { ExpenseCategory } from "@prisma/client";

const optionalString = z.string().trim().optional().or(z.literal(""));

export const expenseSchema = z.object({
  description: z.string().trim().min(2, "Describe the expense").max(300),
  category: z.nativeEnum(ExpenseCategory).default("OTHER"),
  amount: z.coerce
    .number({ invalid_type_error: "Enter a number" })
    .positive("Amount must be greater than zero"),
  currency: z.string().trim().min(3).max(3).default("USD"),
  incurredOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date"),
  vendor: optionalString,
  notes: optionalString,
  isRecurring: z.boolean().default(false),
  clientId: optionalString,
});

export type ExpenseFormValues = z.input<typeof expenseSchema>;
