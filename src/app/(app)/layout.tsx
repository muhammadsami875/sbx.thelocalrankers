import { redirect } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Middleware already guards these routes; this is the defence-in-depth
  // check that also narrows the type for everything below.
  if (!session?.user) redirect("/login");
  if (session.user.role === "CLIENT") redirect("/portal");

  const unreadCount = await prisma.notification.count({
    where: { userId: session.user.id, readAt: null },
  });

  return (
    <SessionProvider session={session}>
      <AppShell
        user={{
          id: session.user.id,
          name: session.user.name ?? null,
          email: session.user.email ?? null,
          image: session.user.image ?? null,
          role: session.user.role,
        }}
        unreadCount={unreadCount}
      >
        {children}
      </AppShell>
    </SessionProvider>
  );
}
