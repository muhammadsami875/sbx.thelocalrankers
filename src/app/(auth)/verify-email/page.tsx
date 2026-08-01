import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export const metadata: Metadata = { title: "Verify email" };

export default function VerifyEmailPage() {
  return (
    <>
      <div className="mb-6 flex size-12 items-center justify-center rounded-lg bg-success/15">
        <ShieldCheck className="size-6 text-success" />
      </div>
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        Verify your email
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Open the message we sent and click the verification link to activate
        your account.
      </p>
      <Link
        href="/login"
        className="mt-8 inline-block text-sm font-medium text-accent underline-offset-4 hover:underline"
      >
        Back to sign in
      </Link>
    </>
  );
}
