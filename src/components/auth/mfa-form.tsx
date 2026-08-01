"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * TOTP challenge UI.
 *
 * The `User.mfaSecret` / `mfaBackup` columns and this screen are in place; the
 * verifying server action lands with the Settings → Security enrolment flow in
 * Phase 2. Until then the field validates shape only and does not grant a
 * session on its own.
 */
export function MfaForm() {
  const router = useRouter();
  const [code, setCode] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const valid = /^\d{6}$/.test(code);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) {
          setError("Enter the 6-digit code from your authenticator app.");
          return;
        }
        setPending(true);
        setError("Two-factor verification is not enabled yet on this account.");
        setPending(false);
      }}
    >
      <Input
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="000000"
        aria-label="Authentication code"
        value={code}
        onChange={(e) => {
          setCode(e.target.value.replace(/\D/g, ""));
          setError(null);
        }}
        className="text-center font-display text-2xl tracking-[0.5em]"
      />

      {error && <p className="text-xs font-medium text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={pending || !valid}>
        {pending && <Loader2 className="animate-spin" />}
        Verify
      </Button>

      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={() => router.push("/login")}
      >
        Use a different account
      </Button>
    </form>
  );
}
