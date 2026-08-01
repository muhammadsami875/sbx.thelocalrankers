import { UserRole } from "@prisma/client";

/**
 * Role-based access control.
 *
 * Permissions are `resource:action` strings. The matrix below is the compiled
 * source of truth — it seeds the `Permission` / `RolePermission` tables so a
 * Super Admin can override grants at runtime without a redeploy.
 *
 * Checks run in three places and must agree:
 *   1. `middleware.ts`  — blocks the route before it renders
 *   2. server actions   — re-check, because middleware can be bypassed
 *   3. the sidebar      — hides what the role cannot reach
 */

export const RESOURCES = [
  "dashboard",
  "clients",
  "leads",
  "projects",
  "tasks",
  "calendar",
  "meetings",
  "invoices",
  "payments",
  "subscriptions",
  "reports",
  "seo",
  "gbp",
  "ads",
  "social",
  "content",
  "files",
  "tickets",
  "employees",
  "timesheets",
  "knowledge",
  "automation",
  "settings",
  "users",
  "audit",
] as const;

export type Resource = (typeof RESOURCES)[number];
export type Action = "read" | "create" | "update" | "delete" | "export" | "manage";
export type Permission = `${Resource}:${Action}` | "*";

const crud = (r: Resource): Permission[] => [
  `${r}:read`,
  `${r}:create`,
  `${r}:update`,
  `${r}:delete`,
];

const readOnly = (...rs: Resource[]): Permission[] => rs.map((r) => `${r}:read` as Permission);

/** Everything a marketing delivery role shares. */
const DELIVERY_BASE: Permission[] = [
  "dashboard:read",
  "clients:read",
  "projects:read",
  "projects:update",
  ...crud("tasks"),
  "calendar:read",
  "meetings:read",
  "meetings:create",
  "files:read",
  "files:create",
  "tickets:read",
  "tickets:update",
  "knowledge:read",
  "timesheets:read",
  "timesheets:create",
  "timesheets:update",
  "reports:read",
];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  // Unrestricted — the wildcard short-circuits every check.
  SUPER_ADMIN: ["*"],

  AGENCY_MANAGER: [
    "dashboard:read",
    ...crud("clients"),
    "clients:export",
    ...crud("leads"),
    ...crud("projects"),
    ...crud("tasks"),
    ...crud("meetings"),
    "calendar:read",
    ...crud("invoices"),
    "invoices:export",
    ...crud("payments"),
    ...crud("subscriptions"),
    ...crud("reports"),
    "reports:export",
    ...crud("seo"),
    ...crud("gbp"),
    ...crud("ads"),
    ...crud("social"),
    ...crud("content"),
    ...crud("files"),
    ...crud("tickets"),
    ...crud("employees"),
    ...crud("timesheets"),
    ...crud("knowledge"),
    ...crud("automation"),
    "settings:read",
    "settings:update",
    "users:read",
    "users:create",
    "users:update",
    "audit:read",
  ],

  MARKETING_MANAGER: [
    "dashboard:read",
    "clients:read",
    "clients:update",
    ...crud("leads"),
    ...crud("projects"),
    ...crud("tasks"),
    ...crud("meetings"),
    "calendar:read",
    ...crud("reports"),
    "reports:export",
    ...crud("seo"),
    ...crud("gbp"),
    ...crud("ads"),
    ...crud("social"),
    ...crud("content"),
    ...crud("files"),
    ...crud("tickets"),
    ...crud("knowledge"),
    "automation:read",
    "timesheets:read",
    "invoices:read",
  ],

  SEO_TEAM: [
    ...DELIVERY_BASE,
    ...crud("seo"),
    ...crud("gbp"),
    "seo:export",
    "content:read",
    "content:create",
    "content:update",
    "reports:create",
  ],

  GOOGLE_ADS_TEAM: [
    ...DELIVERY_BASE,
    ...crud("ads"),
    "ads:export",
    "reports:create",
  ],

  SOCIAL_MEDIA_TEAM: [
    ...DELIVERY_BASE,
    ...crud("social"),
    ...crud("content"),
    "gbp:read",
    "gbp:update",
    "reports:create",
  ],

  DEVELOPER: [
    ...DELIVERY_BASE,
    "projects:create",
    "projects:delete",
    "files:update",
    "files:delete",
  ],

  DESIGNER: [
    ...DELIVERY_BASE,
    "files:update",
    "files:delete",
    "content:read",
    "social:read",
  ],

  CONTENT_WRITER: [
    ...DELIVERY_BASE,
    ...crud("content"),
    "seo:read",
    "social:read",
    "social:create",
    "knowledge:create",
    "knowledge:update",
  ],

  // Scoped to the caller's own client record — see scopeToClient().
  CLIENT: [
    "dashboard:read",
    "projects:read",
    "tasks:read",
    "invoices:read",
    "payments:read",
    "reports:read",
    "seo:read",
    "gbp:read",
    "ads:read",
    "social:read",
    "files:read",
    "meetings:read",
    "calendar:read",
    "tickets:read",
    "tickets:create",
    "tickets:update",
    "knowledge:read",
  ],

  ACCOUNTANT: [
    "dashboard:read",
    "clients:read",
    ...crud("invoices"),
    "invoices:export",
    ...crud("payments"),
    "payments:export",
    ...crud("subscriptions"),
    "reports:read",
    "reports:export",
    "employees:read",
    "timesheets:read",
    "files:read",
    "settings:read",
  ],

  READ_ONLY: [
    ...readOnly(
      "dashboard",
      "clients",
      "leads",
      "projects",
      "tasks",
      "calendar",
      "meetings",
      "invoices",
      "payments",
      "reports",
      "seo",
      "gbp",
      "ads",
      "social",
      "files",
      "tickets",
      "knowledge",
    ),
  ],
};

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Admin",
  AGENCY_MANAGER: "Agency Manager",
  MARKETING_MANAGER: "Marketing Manager",
  SEO_TEAM: "SEO Team",
  GOOGLE_ADS_TEAM: "Google Ads Team",
  SOCIAL_MEDIA_TEAM: "Social Media Team",
  DEVELOPER: "Developer",
  DESIGNER: "Designer",
  CONTENT_WRITER: "Content Writer",
  CLIENT: "Client",
  ACCOUNTANT: "Accountant",
  READ_ONLY: "Read-only User",
};

/** Roles that log into the internal app rather than the client portal. */
export const STAFF_ROLES: UserRole[] = (
  Object.keys(ROLE_PERMISSIONS) as UserRole[]
).filter((r) => r !== "CLIENT");

export function isStaff(role: UserRole | undefined | null): boolean {
  return !!role && role !== "CLIENT";
}

/** Does `role` hold `permission`? SUPER_ADMIN's "*" satisfies everything. */
export function can(
  role: UserRole | undefined | null,
  permission: Permission,
): boolean {
  if (!role) return false;
  const granted = ROLE_PERMISSIONS[role];
  if (!granted) return false;
  if (granted.includes("*")) return true;
  return granted.includes(permission);
}

/** True if the role can reach a resource at all (any action on it). */
export function canAccessResource(
  role: UserRole | undefined | null,
  resource: Resource,
): boolean {
  if (!role) return false;
  const granted = ROLE_PERMISSIONS[role];
  if (!granted) return false;
  if (granted.includes("*")) return true;
  return granted.some((p) => p.startsWith(`${resource}:`));
}

/**
 * Throws when the permission is missing. Use at the top of every server
 * action — middleware alone is not a sufficient guard.
 */
export function requirePermission(
  role: UserRole | undefined | null,
  permission: Permission,
): void {
  if (!can(role, permission)) {
    throw new PermissionError(permission);
  }
}

export class PermissionError extends Error {
  constructor(public readonly permission: Permission) {
    super(`Missing permission: ${permission}`);
    this.name = "PermissionError";
  }
}

/**
 * Returns a Prisma `where` fragment restricting CLIENT users to their own
 * record. Staff roles get an empty object (no restriction).
 *
 * A CLIENT with no clientId is deliberately given an unsatisfiable filter so a
 * misconfigured account leaks nothing.
 */
export function scopeToClient(
  role: UserRole | undefined | null,
  clientId: string | null | undefined,
): { clientId?: string } {
  if (role !== "CLIENT") return {};
  return { clientId: clientId ?? "__no_client__" };
}
