import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { hasGoogleAuth, hasMagicLink } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Welcome back
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to your Local Rankers CRM account.
        </p>
      </div>

      {/* LoginForm reads ?callbackUrl via useSearchParams, which opts the
          subtree into client-side rendering and needs a Suspense boundary. */}
      <Suspense fallback={<LoginFormSkeleton />}>
        <LoginForm googleEnabled={hasGoogleAuth} magicLinkEnabled={hasMagicLink} />
      </Suspense>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Need an account?{" "}
        <Link
          href="/register"
          className="font-medium text-accent underline-offset-4 hover:underline"
        >
          Request access
        </Link>
      </p>
    </>
  );
}

function LoginFormSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-12" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
