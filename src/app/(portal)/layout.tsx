import Link from "next/link";
import { redirect } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BrandLogo } from "@/components/brand/brand-logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { PortalNav } from "@/components/portal/portal-nav";
import { PortalUserMenu } from "@/components/portal/portal-user-menu";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) redirect("/login");
  if (session.user.role !== "CLIENT") redirect("/dashboard");

  const client = session.user.clientId
    ? await prisma.client.findFirst({
        where: { id: session.user.clientId, deletedAt: null },
        select: { id: true, companyName: true, logoUrl: true },
      })
    : null;

  return (
    <SessionProvider session={session}>
      <div className="flex min-h-dvh flex-col bg-background">
        <header className="glass sticky top-0 z-30 border-b border-border">
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4 sm:px-6">
            <Link href="/portal" className="shrink-0">
              <BrandLogo className="h-8" priority />
            </Link>

            {client && (
              <>
                <span className="hidden h-6 w-px bg-border sm:block" />
                <p className="hidden truncate text-sm font-medium sm:block">
                  {client.companyName}
                </p>
              </>
            )}

            <div className="ml-auto flex items-center gap-1">
              <ThemeToggle />
              <PortalUserMenu
                name={session.user.name ?? null}
                email={session.user.email ?? null}
                image={session.user.image ?? null}
                userId={session.user.id}
              />
            </div>
          </div>

          <PortalNav />
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>

        <footer className="border-t border-border py-6">
          <p className="text-center text-xs text-muted-foreground">
            Local Rankers LLC · Hicksville, NY · (516) 585-6503
          </p>
        </footer>
      </div>
    </SessionProvider>
  );
}
