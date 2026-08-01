import type { Metadata } from "next";
import { KeyRound } from "lucide-react";
import { MfaForm } from "@/components/auth/mfa-form";

export const metadata: Metadata = { title: "Two-factor authentication" };

export default function MfaPage() {
  return (
    <>
      <div className="mb-6 flex size-12 items-center justify-center rounded-lg bg-accent/15">
        <KeyRound className="size-6 text-accent" />
      </div>
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        Two-factor authentication
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Enter the 6-digit code from your authenticator app.
      </p>

      <div className="mt-8">
        <MfaForm />
      </div>
    </>
  );
}
