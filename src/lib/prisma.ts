import { PrismaClient } from "@prisma/client";

// Next.js dev-mode hot reload would otherwise open a new pool on every edit.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** Every list query filters soft-deleted rows through this. */
export const notDeleted = { deletedAt: null } as const;
