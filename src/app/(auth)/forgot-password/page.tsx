import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Reset your password
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We&apos;ll email you a link to choose a new one.
        </p>
      </div>

      <ForgotPasswordForm />

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link
          href="/login"
          className="font-medium text-accent underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </>
  );
}
