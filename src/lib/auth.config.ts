import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import type { UserRole } from "@prisma/client";

/**
 * Edge-safe auth config.
 *
 * `middleware.ts` runs on the edge runtime, where Prisma and bcrypt cannot be
 * imported. Everything here must stay free of Node-only dependencies; the
 * Credentials provider and Prisma adapter are added in `auth.ts`, which only
 * runs in the Node runtime.
 */

const hasGoogle = !!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET;

export const authConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
    verifyRequest: "/verify-request",
  },
  session: {
    // JWT (not database) so middleware can read the session without Prisma.
    strategy: "jwt",
    maxAge: 60 * 60 * 8, // 8h — session timeout per the security spec
    updateAge: 60 * 30,
  },
  providers: hasGoogle
    ? [
        Google({
          clientId: process.env.AUTH_GOOGLE_ID,
          clientSecret: process.env.AUTH_GOOGLE_SECRET,
          allowDangerousEmailAccountLinking: true,
        }),
      ]
    : [],
  callbacks: {
    /**
     * Persist role/clientId onto the token so authorization checks never need
     * a DB round-trip. `trigger === "update"` lets a role change take effect
     * without forcing the user to sign out.
     */
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role?: UserRole }).role ?? "READ_ONLY";
        token.clientId = (user as { clientId?: string | null }).clientId ?? null;
        token.mfaEnabled = (user as { mfaEnabled?: boolean }).mfaEnabled ?? false;
      }
      if (trigger === "update" && session) {
        token.role = session.role ?? token.role;
        token.clientId = session.clientId ?? token.clientId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.clientId = (token.clientId as string | null) ?? null;
        session.user.mfaEnabled = (token.mfaEnabled as boolean) ?? false;
      }
      return session;
    },
  },
  trustHost: true,
} satisfies NextAuthConfig;
