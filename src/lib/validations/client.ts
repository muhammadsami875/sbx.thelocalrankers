import { z } from "zod";
import {
  ClientStatus,
  Priority,
  ServiceType,
} from "@prisma/client";

/** Optional URL/email fields arrive as "" from empty inputs, not undefined. */
const optionalUrl = z
  .string()
  .trim()
  .url("Enter a valid URL (including https://)")
  .optional()
  .or(z.literal(""));

const optionalString = z.string().trim().optional().or(z.literal(""));

export const clientSchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(2, "Company name is required")
    .max(160, "Company name is too long"),
  ownerName: optionalString,
  contactPerson: optionalString,
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .optional()
    .or(z.literal("")),
  phone: optionalString,
  website: optionalUrl,
  businessCategory: optionalString,

  addressLine1: optionalString,
  addressLine2: optionalString,
  city: optionalString,
  state: optionalString,
  zipCode: optionalString,
  country: optionalString,

  googleBusinessProfile: optionalUrl,
  facebookUrl: optionalUrl,
  instagramUrl: optionalUrl,
  linkedinUrl: optionalUrl,
  youtubeUrl: optionalUrl,
  tiktokUrl: optionalUrl,
  twitterUrl: optionalUrl,

  logoUrl: optionalUrl,
  notes: z.string().trim().max(5000).optional().or(z.literal("")),

  status: z.nativeEnum(ClientStatus).default("ACTIVE"),
  priority: z.nativeEnum(Priority).default("MEDIUM"),

  monthlyRetainer: z
    .union([z.coerce.number().min(0, "Must be zero or more"), z.literal("")])
    .optional(),

  // Dates arrive as "yyyy-MM-dd" from <input type="date">.
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date")
    .optional()
    .or(z.literal("")),
  renewalDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date")
    .optional()
    .or(z.literal("")),

  accountManagerId: optionalString,
  services: z.array(z.nativeEnum(ServiceType)).default([]),
  tags: z.array(z.string().trim().min(1)).default([]),
});

export type ClientFormValues = z.input<typeof clientSchema>;
export type ClientFormOutput = z.output<typeof clientSchema>;

/** Query params for the clients list — parsed on the server. */
export const clientListParamsSchema = z.object({
  q: z.string().trim().optional(),
  status: z.nativeEnum(ClientStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  accountManagerId: z.string().optional(),
  sort: z
    .enum(["companyName", "createdAt", "renewalDate", "monthlyRetainer", "status"])
    .default("companyName"),
  dir: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(10).max(100).default(25),
});

export type ClientListParams = z.output<typeof clientListParamsSchema>;

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  LEAD: "Lead",
  ONBOARDING: "Onboarding",
  ACTIVE: "Active",
  PAUSED: "Paused",
  INACTIVE: "Inactive",
  CHURNED: "Churned",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export const SERVICE_LABELS: Record<ServiceType, string> = {
  LOCAL_SEO: "Local SEO",
  NATIONAL_SEO: "National SEO",
  GOOGLE_ADS: "Google Ads",
  META_ADS: "Meta Ads",
  WEB_DESIGN: "Web Design",
  WEB_DEVELOPMENT: "Web Development",
  SOCIAL_MEDIA: "Social Media",
  CONTENT_MARKETING: "Content Marketing",
  EMAIL_MARKETING: "Email Marketing",
  GBP_MANAGEMENT: "GBP Management",
  REPUTATION_MANAGEMENT: "Reputation Management",
  CITATION_BUILDING: "Citation Building",
  HOSTING_MAINTENANCE: "Hosting & Maintenance",
};

export const STATUS_BADGE_VARIANT: Record<
  ClientStatus,
  "success" | "info" | "warning" | "muted" | "danger"
> = {
  ACTIVE: "success",
  ONBOARDING: "info",
  LEAD: "info",
  PAUSED: "warning",
  INACTIVE: "muted",
  CHURNED: "danger",
};

export const PRIORITY_BADGE_VARIANT: Record<
  Priority,
  "muted" | "info" | "warning" | "danger"
> = {
  LOW: "muted",
  MEDIUM: "info",
  HIGH: "warning",
  URGENT: "danger",
};
