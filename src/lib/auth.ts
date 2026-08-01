import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Resend from "next-auth/providers/resend";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/** Magic-link sign-in is only offered when a Resend key is configured. */
export const hasMagicLink = !!process.env.AUTH_RESEND_KEY;
export const hasGoogleAuth =
  !!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    ...authConfig.providers,
    ...(hasMagicLink
      ? [
          Resend({
            apiKey: process.env.AUTH_RESEND_KEY,
            from: process.env.EMAIL_FROM ?? "noreply@thelocalrankers.com",
          }),
        ]
      : []),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await prisma.user.findFirst({
          where: { email: email.toLowerCase(), deletedAt: null },
        });

        // Compare against a dummy hash when the user is missing so the
        // response time does not reveal whether the address exists.
        const hash =
          user?.passwordHash ??
          "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvaliduO";
        const ok = await bcrypt.compare(password, hash);

        if (!user || !ok) return null;
        if (user.status === "SUSPENDED" || user.status === "DEACTIVATED") {
          throw new Error("Your account is not active. Contact an administrator.");
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
          clientId: user.clientId,
          mfaEnabled: user.mfaEnabled,
        };
      },
    }),
  ],
  events: {
    async signIn({ user }) {
      if (!user.id) return;
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "LOGIN",
          entity: "User",
          entityId: user.id,
          summary: `${user.email} signed in`,
        },
      });
    },
    async signOut(message) {
      const userId =
        "token" in message ? (message.token?.id as string | undefined) : undefined;
      if (!userId) return;
      await prisma.auditLog.create({
        data: {
          userId,
          action: "LOGOUT",
          entity: "User",
          entityId: userId,
          summary: "Signed out",
        },
      });
    },
  },
});

/**
 * Session accessor for server components and actions.
 * Throws when unauthenticated so callers can rely on a non-null user.
 */
export async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHENTICATED");
  return session;
}

export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}
