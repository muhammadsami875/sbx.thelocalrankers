import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";

export const metadata: Metadata = { title: "Check your email" };

export default function VerifyRequestPage() {
  return (
    <>
      <div className="mb-6 flex size-12 items-center justify-center rounded-lg bg-accent/15">
        <MailCheck className="size-6 text-accent" />
      </div>
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        Check your email
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        We sent a sign-in link to your inbox. It expires in 24 hours and can
        only be used once.
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
