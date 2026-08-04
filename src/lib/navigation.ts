import {
  BarChart3,
  Banknote,
  Building2,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  CreditCard,
  HandCoins,
  Wallet,
  FileText,
  FolderKanban,
  Gauge,
  LifeBuoy,
  MapPin,
  Megaphone,
  MessagesSquare,
  Receipt,
  Repeat,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  Timer,
  TrendingUp,
  Users,
  UsersRound,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { Resource } from "@/lib/rbac";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** RBAC resource guarding this item; the sidebar hides it when unreachable. */
  resource: Resource;
  /** Marks routes that are scaffolded but land in a later phase. */
  soon?: boolean;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

/** Internal (staff) navigation. */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: Gauge, resource: "dashboard" },
      { label: "Reports", href: "/reports", icon: BarChart3, resource: "reports", soon: true },
    ],
  },
  {
    label: "Sales",
    items: [
      { label: "Leads", href: "/leads", icon: TrendingUp, resource: "leads", soon: true },
      { label: "Clients", href: "/clients", icon: Building2, resource: "clients" },
    ],
  },
  {
    label: "Delivery",
    items: [
      { label: "Projects", href: "/projects", icon: FolderKanban, resource: "projects", soon: true },
      { label: "Tasks", href: "/tasks", icon: ClipboardList, resource: "tasks", soon: true },
      { label: "Calendar", href: "/calendar", icon: CalendarDays, resource: "calendar", soon: true },
    ],
  },
  {
    label: "Marketing",
    items: [
      { label: "SEO", href: "/seo", icon: Search, resource: "seo", soon: true },
      { label: "Google Business", href: "/gbp", icon: MapPin, resource: "gbp", soon: true },
      { label: "Ads", href: "/ads", icon: Megaphone, resource: "ads", soon: true },
      { label: "Social", href: "/social", icon: Share2, resource: "social", soon: true },
      { label: "Content", href: "/content", icon: FileText, resource: "content", soon: true },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Invoices", href: "/invoices", icon: Receipt, resource: "invoices" },
      { label: "Payments", href: "/payments", icon: CreditCard, resource: "payments" },
      { label: "Subscriptions", href: "/subscriptions", icon: Repeat, resource: "subscriptions" },
      { label: "Expenses", href: "/expenses", icon: Banknote, resource: "expenses" },
    ],
  },
  {
    label: "Team",
    items: [
      { label: "Attendance", href: "/attendance", icon: CalendarCheck, resource: "attendance" },
      { label: "My Sales", href: "/sales", icon: HandCoins, resource: "sales" },
      { label: "Employees", href: "/employees", icon: UsersRound, resource: "employees" },
      { label: "Payroll", href: "/payroll", icon: Wallet, resource: "payroll" },
      { label: "Timesheets", href: "/timesheets", icon: Timer, resource: "timesheets", soon: true },
    ],
  },
  {
    label: "Support",
    items: [
      { label: "Tickets", href: "/tickets", icon: LifeBuoy, resource: "tickets", soon: true },
      { label: "Knowledge Base", href: "/knowledge", icon: MessagesSquare, resource: "knowledge", soon: true },
    ],
  },
  {
    label: "System",
    items: [
      { label: "AI Studio", href: "/ai", icon: Sparkles, resource: "content", soon: true },
      { label: "Automation", href: "/automation", icon: Workflow, resource: "automation", soon: true },
      { label: "Users", href: "/users", icon: Users, resource: "users", soon: true },
      { label: "Audit Log", href: "/audit", icon: ShieldCheck, resource: "audit", soon: true },
      { label: "Settings", href: "/settings", icon: Settings, resource: "settings", soon: true },
    ],
  },
];

/** Client-portal navigation (CLIENT role only). */
export const PORTAL_NAV: NavItem[] = [
  { label: "Overview", href: "/portal", icon: Gauge, resource: "dashboard" },
  { label: "Projects", href: "/portal/projects", icon: FolderKanban, resource: "projects", soon: true },
  { label: "SEO Rankings", href: "/portal/seo", icon: Search, resource: "seo", soon: true },
  { label: "Google Business", href: "/portal/gbp", icon: MapPin, resource: "gbp", soon: true },
  { label: "Ads", href: "/portal/ads", icon: Megaphone, resource: "ads", soon: true },
  { label: "Reports", href: "/portal/reports", icon: BarChart3, resource: "reports", soon: true },
  { label: "Invoices", href: "/portal/invoices", icon: Receipt, resource: "invoices", soon: true },
  { label: "Files", href: "/portal/files", icon: FileText, resource: "files", soon: true },
  { label: "Support", href: "/portal/tickets", icon: LifeBuoy, resource: "tickets", soon: true },
];

/** Human-readable segment names for breadcrumbs. */
export const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  clients: "Clients",
  leads: "Leads",
  projects: "Projects",
  tasks: "Tasks",
  calendar: "Calendar",
  invoices: "Invoices",
  payments: "Payments",
  subscriptions: "Subscriptions",
  reports: "Reports",
  seo: "SEO",
  gbp: "Google Business",
  ads: "Ads",
  social: "Social",
  content: "Content",
  files: "Files",
  tickets: "Tickets",
  employees: "Employees",
  attendance: "Attendance",
  sales: "Sales",
  payroll: "Payroll",
  expenses: "Expenses",
  timesheets: "Timesheets",
  knowledge: "Knowledge Base",
  automation: "Automation",
  settings: "Settings",
  users: "Users",
  audit: "Audit Log",
  ai: "AI Studio",
  portal: "Client Portal",
  new: "New",
};
