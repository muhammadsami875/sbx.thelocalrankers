import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { canAccessResource, type Resource } from "@/lib/rbac";

const { auth } = NextAuth(authConfig);

const PUBLIC_ROUTES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/verify-request",
  "/mfa",
];

/**
 * Maps the first path segment of an internal route to the RBAC resource that
 * guards it. Anything not listed needs only a valid session.
 */
const ROUTE_RESOURCE: Record<string, Resource> = {
  dashboard: "dashboard",
  clients: "clients",
  leads: "leads",
  projects: "projects",
  tasks: "tasks",
  calendar: "calendar",
  meetings: "meetings",
  invoices: "invoices",
  payments: "payments",
  subscriptions: "subscriptions",
  reports: "reports",
  seo: "seo",
  gbp: "gbp",
  ads: "ads",
  social: "social",
  content: "content",
  files: "files",
  tickets: "tickets",
  employees: "employees",
  timesheets: "timesheets",
  knowledge: "knowledge",
  automation: "automation",
  settings: "settings",
  users: "users",
  audit: "audit",
};

export default auth((req) => {
  const { nextUrl } = req;
  const path = nextUrl.pathname;
  const user = req.auth?.user;
  const isLoggedIn = !!user;
  const isPublic = PUBLIC_ROUTES.some(
    (r) => path === r || path.startsWith(`${r}/`),
  );

  // Signed-in users never see the auth pages.
  if (isPublic) {
    if (isLoggedIn) {
      const home = user.role === "CLIENT" ? "/portal" : "/dashboard";
      return NextResponse.redirect(new URL(home, nextUrl));
    }
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    // Preserve the destination so login can bounce the user back.
    const login = new URL("/login", nextUrl);
    if (path !== "/") login.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(login);
  }

  const isPortal = path === "/portal" || path.startsWith("/portal/");

  // Clients live in /portal and may not reach the internal app; staff are
  // sent the other way so they don't land in a client-scoped view.
  if (user.role === "CLIENT" && !isPortal) {
    return NextResponse.redirect(new URL("/portal", nextUrl));
  }
  if (user.role !== "CLIENT" && isPortal) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  if (!isPortal) {
    const segment = path.split("/")[1] ?? "";
    const resource = ROUTE_RESOURCE[segment];
    if (resource && !canAccessResource(user.role, resource)) {
      return NextResponse.redirect(new URL("/dashboard?denied=1", nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  // Skip Next internals, the auth API, and static assets.
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|favicon-32.png|apple-icon.png|images/|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)",
  ],
};
