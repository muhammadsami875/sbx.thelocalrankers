import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export const metadata: Metadata = { title: "Request access" };

export default function RegisterPage() {
  return (
    <>
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Request access
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The CRM is invite-only.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <ShieldCheck className="size-5 text-accent" />
        <h2 className="mt-3 font-display text-sm font-semibold">
          Accounts are created by an administrator
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          To protect client data, staff and client-portal accounts are
          provisioned from{" "}
          <span className="font-medium text-foreground">Settings → Users</span>{" "}
          by a Super Admin or Agency Manager. Ask your manager to invite you,
          then use the link in your email to set a password.
        </p>
      </div>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-accent underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </>
  );
}
