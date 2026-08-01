"use server";

import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * Issues a password-reset token.
 *
 * Returns void unconditionally — the caller always shows the same message so
 * the response cannot be used to enumerate registered addresses.
 *
 * Phase 2 wires the Resend send; for now the token row is created and the link
 * is logged in development so the flow is testable end to end.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();

  const user = await prisma.user.findFirst({
    where: { email: normalized, deletedAt: null },
    select: { id: true },
  });
  if (!user) return;

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.verificationToken.create({
    data: { identifier: `reset:${normalized}`, token, expires },
  });

  await prisma.emailLog.create({
    data: {
      to: normalized,
      from: process.env.EMAIL_FROM ?? "noreply@thelocalrankers.com",
      subject: "Reset your Local Rankers CRM password",
      template: "password_reset",
      status: "QUEUED",
      relatedEntity: "User",
      relatedEntityId: user.id,
    },
  });

  if (process.env.NODE_ENV === "development") {
    console.log(
      `[auth] password reset link: ${process.env.AUTH_URL ?? "http://localhost:3100"}/reset-password?token=${token}`,
    );
  }
}
