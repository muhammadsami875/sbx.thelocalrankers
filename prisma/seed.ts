/**
 * Seeds a realistic agency dataset so every chart, table and KPI has data on
 * first run. Idempotent: users/tags/settings are upserted, business rows are
 * cleared and regenerated.
 *
 *   npm run db:seed
 */
import {
  AdPlatform,
  ClientStatus,
  InvoiceStatus,
  LeadSource,
  LeadStatus,
  PaymentMethod,
  PrismaClient,
  Priority,
  ProjectStatus,
  ProjectType,
  ServiceType,
  SocialPlatform,
  TaskStatus,
  UserRole,
  type Prisma,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Deterministic PRNG so reseeding produces a stable dataset.
let seedState = 42;
function rand() {
  seedState = (seedState * 1664525 + 1013904223) % 4294967296;
  return seedState / 4294967296;
}
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!;
const int = (min: number, max: number) =>
  Math.floor(rand() * (max - min + 1)) + min;
const chance = (p: number) => rand() < p;
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const daysAhead = (n: number) => new Date(Date.now() + n * 86_400_000);

const DEMO_PASSWORD = "LocalRankers!2026";

const STAFF: Array<{
  name: string;
  email: string;
  role: UserRole;
  title: string;
}> = [
  { name: "Tom Lyne", email: "tom@thelocalrankers.com", role: "SUPER_ADMIN", title: "Founder" },
  { name: "Dana Whitfield", email: "dana@thelocalrankers.com", role: "AGENCY_MANAGER", title: "Agency Manager" },
  { name: "Marcus Reed", email: "marcus@thelocalrankers.com", role: "MARKETING_MANAGER", title: "Marketing Manager" },
  { name: "Priya Nair", email: "priya@thelocalrankers.com", role: "SEO_TEAM", title: "Senior SEO Strategist" },
  { name: "Alex Contreras", email: "alex@thelocalrankers.com", role: "GOOGLE_ADS_TEAM", title: "Paid Search Lead" },
  { name: "Jordan Blake", email: "jordan@thelocalrankers.com", role: "SOCIAL_MEDIA_TEAM", title: "Social Media Manager" },
  { name: "Sam Okafor", email: "sam@thelocalrankers.com", role: "DEVELOPER", title: "Web Developer" },
  { name: "Elena Vasquez", email: "elena@thelocalrankers.com", role: "DESIGNER", title: "Brand Designer" },
  { name: "Riley Chen", email: "riley@thelocalrankers.com", role: "CONTENT_WRITER", title: "Content Writer" },
  { name: "Nina Patel", email: "nina@thelocalrankers.com", role: "ACCOUNTANT", title: "Accountant" },
  { name: "Chris Doyle", email: "chris@thelocalrankers.com", role: "READ_ONLY", title: "Advisor" },
];

const CLIENTS: Array<{
  company: string;
  owner: string;
  category: string;
  city: string;
  state: string;
  zip: string;
  retainer: number;
  services: ServiceType[];
}> = [
  { company: "317 Restoration", owner: "Derek Halvorsen", category: "Roofing & Restoration", city: "Indianapolis", state: "IN", zip: "46204", retainer: 2800, services: ["LOCAL_SEO", "GOOGLE_ADS", "GBP_MANAGEMENT"] },
  { company: "Drop The Gloves Junk Removal", owner: "Mike Brennan", category: "Junk Removal", city: "Buffalo", state: "NY", zip: "14201", retainer: 1450, services: ["LOCAL_SEO", "WEB_DESIGN", "GBP_MANAGEMENT"] },
  { company: "EZ-CO Luxury Plumbing", owner: "Carlos Ezeqiel", category: "Plumbing", city: "Phoenix", state: "AZ", zip: "85004", retainer: 2200, services: ["LOCAL_SEO", "GOOGLE_ADS"] },
  { company: "Masterguard Insulation", owner: "Ben Tafoya", category: "Insulation Contractor", city: "Fresno", state: "CA", zip: "93701", retainer: 1950, services: ["LOCAL_SEO", "WEB_DESIGN", "META_ADS"] },
  { company: "Precision Foundation Repair", owner: "Wanda Klein", category: "Foundation Repair", city: "Little Rock", state: "AR", zip: "72201", retainer: 2400, services: ["LOCAL_SEO", "GOOGLE_ADS", "CITATION_BUILDING"] },
  { company: "BrightStars Home Care", owner: "Adaeze Nwosu", category: "Pediatric Home Care", city: "Atlanta", state: "GA", zip: "30303", retainer: 3100, services: ["LOCAL_SEO", "CONTENT_MARKETING", "WEB_DEVELOPMENT"] },
  { company: "Nanny's Daycare", owner: "Grace Miller", category: "Childcare", city: "Charlotte", state: "NC", zip: "28202", retainer: 1200, services: ["LOCAL_SEO", "SOCIAL_MEDIA"] },
  { company: "Florida Decorative Concrete", owner: "Luis Ramirez", category: "Concrete & Epoxy", city: "Tampa", state: "FL", zip: "33602", retainer: 1750, services: ["LOCAL_SEO", "WEB_DESIGN", "GBP_MANAGEMENT"] },
  { company: "Take Your Junk UAE", owner: "Omar Haddad", category: "Junk Removal", city: "Dubai", state: "DU", zip: "00000", retainer: 2050, services: ["LOCAL_SEO", "GOOGLE_ADS", "SOCIAL_MEDIA"] },
  { company: "Harbor Point Dental", owner: "Dr. Alicia Moreau", category: "Dental Practice", city: "Stamford", state: "CT", zip: "06901", retainer: 2650, services: ["LOCAL_SEO", "GOOGLE_ADS", "REPUTATION_MANAGEMENT"] },
  { company: "Ironclad Garage Doors", owner: "Rex Palmer", category: "Garage Door Repair", city: "Denver", state: "CO", zip: "80202", retainer: 1600, services: ["LOCAL_SEO", "GBP_MANAGEMENT"] },
  { company: "Summit Peak Landscaping", owner: "Hannah Voss", category: "Landscaping", city: "Boise", state: "ID", zip: "83702", retainer: 1350, services: ["LOCAL_SEO", "SOCIAL_MEDIA", "WEB_DESIGN"] },
  { company: "Coastal Air HVAC", owner: "Tony Marchetti", category: "HVAC", city: "Wilmington", state: "NC", zip: "28401", retainer: 2300, services: ["LOCAL_SEO", "GOOGLE_ADS", "META_ADS"] },
  { company: "Willow Creek Veterinary", owner: "Dr. Sana Iqbal", category: "Veterinary Clinic", city: "Madison", state: "WI", zip: "53703", retainer: 1500, services: ["LOCAL_SEO", "CONTENT_MARKETING"] },
  { company: "Redline Auto Detailing", owner: "Jamal Foster", category: "Auto Detailing", city: "Memphis", state: "TN", zip: "38103", retainer: 950, services: ["LOCAL_SEO", "SOCIAL_MEDIA"] },
  { company: "Beacon Hill Law Group", owner: "Patricia Donnelly", category: "Law Firm", city: "Boston", state: "MA", zip: "02108", retainer: 4200, services: ["NATIONAL_SEO", "GOOGLE_ADS", "CONTENT_MARKETING"] },
  { company: "Golden Fork Catering", owner: "Marco Bellini", category: "Catering", city: "Sacramento", state: "CA", zip: "95814", retainer: 1100, services: ["LOCAL_SEO", "SOCIAL_MEDIA", "WEB_DESIGN"] },
  { company: "Titan Pest Control", owner: "Dwayne Ellis", category: "Pest Control", city: "Houston", state: "TX", zip: "77002", retainer: 1850, services: ["LOCAL_SEO", "GOOGLE_ADS", "GBP_MANAGEMENT"] },
  { company: "Lakeside Chiropractic", owner: "Dr. Erin Vogel", category: "Chiropractic", city: "Minneapolis", state: "MN", zip: "55401", retainer: 1400, services: ["LOCAL_SEO", "REPUTATION_MANAGEMENT"] },
  { company: "Stonebridge Roofing", owner: "Curtis Nakamura", category: "Roofing", city: "Portland", state: "OR", zip: "97204", retainer: 2750, services: ["LOCAL_SEO", "GOOGLE_ADS", "WEB_DEVELOPMENT"] },
  { company: "Verde Solar Solutions", owner: "Ana Delgado", category: "Solar Installation", city: "Albuquerque", state: "NM", zip: "87102", retainer: 3400, services: ["LOCAL_SEO", "GOOGLE_ADS", "META_ADS", "CONTENT_MARKETING"] },
  { company: "Cornerstone Fitness", owner: "Trey Wilkins", category: "Gym & Fitness", city: "Nashville", state: "TN", zip: "37201", retainer: 1250, services: ["SOCIAL_MEDIA", "LOCAL_SEO"] },
  { company: "Maple Grove Realty", owner: "Susan Achterberg", category: "Real Estate", city: "Columbus", state: "OH", zip: "43215", retainer: 2100, services: ["LOCAL_SEO", "GOOGLE_ADS", "WEB_DESIGN"] },
  { company: "Blue Heron Pool Service", owner: "Rico Santana", category: "Pool Maintenance", city: "Orlando", state: "FL", zip: "32801", retainer: 1050, services: ["LOCAL_SEO", "GBP_MANAGEMENT"] },
  { company: "Northgate Moving Co", owner: "Frank Osei", category: "Moving Company", city: "Seattle", state: "WA", zip: "98101", retainer: 1900, services: ["LOCAL_SEO", "GOOGLE_ADS"] },
];

const TAGS = [
  { name: "Retainer", color: "#86BD3E" },
  { name: "High Value", color: "#10AA99" },
  { name: "Referral", color: "#6366F1" },
  { name: "Upsell Ready", color: "#F59E0B" },
  { name: "At Risk", color: "#EF4444" },
  { name: "New Logo", color: "#0EA5E9" },
];

const KEYWORD_TEMPLATES = [
  (c: string) => `${c} near me`,
  (c: string) => `best ${c}`,
  (c: string) => `${c} company`,
  (c: string) => `affordable ${c}`,
  (c: string) => `emergency ${c}`,
  (c: string) => `${c} reviews`,
];

async function main() {
  console.log("\n  Seeding The Local Rankers CRM...\n");

  console.log("   clearing existing business rows...");
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.seoRanking.deleteMany(),
    prisma.seoKeyword.deleteMany(),
    prisma.gbpInsight.deleteMany(),
    prisma.adsCampaign.deleteMany(),
    prisma.socialPost.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.invoiceItem.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.subscription.deleteMany(),
    prisma.timeEntry.deleteMany(),
    prisma.task.deleteMany(),
    prisma.projectMember.deleteMany(),
    prisma.project.deleteMany(),
    prisma.meetingAttendee.deleteMany(),
    prisma.meeting.deleteMany(),
    prisma.ticketMessage.deleteMany(),
    prisma.ticket.deleteMany(),
    prisma.fileAsset.deleteMany(),
    prisma.note.deleteMany(),
    prisma.lead.deleteMany(),
    prisma.pipelineStage.deleteMany(),
    prisma.pipeline.deleteMany(),
    prisma.clientTag.deleteMany(),
    prisma.clientService.deleteMany(),
    prisma.clientContact.deleteMany(),
    prisma.report.deleteMany(),
    prisma.client.deleteMany(),
  ]);

  // ── Users ────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const staff = await Promise.all(
    STAFF.map((person) =>
      prisma.user.upsert({
        where: { email: person.email },
        create: {
          name: person.name,
          email: person.email,
          passwordHash,
          role: person.role,
          jobTitle: person.title,
          status: "ACTIVE",
          emailVerified: new Date(),
          lastLoginAt: daysAgo(int(0, 6)),
        },
        update: { passwordHash, role: person.role, jobTitle: person.title },
      }),
    ),
  );
  console.log(`   + ${staff.length} staff users`);

  const byRole = (role: UserRole) => staff.filter((u) => u.role === role);
  const managers = [
    ...byRole("SUPER_ADMIN"),
    ...byRole("AGENCY_MANAGER"),
    ...byRole("MARKETING_MANAGER"),
  ];
  const deliveryRoles: UserRole[] = [
    "SEO_TEAM",
    "GOOGLE_ADS_TEAM",
    "SOCIAL_MEDIA_TEAM",
    "DEVELOPER",
    "DESIGNER",
    "CONTENT_WRITER",
  ];
  const deliveryTeam = staff.filter((u) => deliveryRoles.includes(u.role));

  await Promise.all(
    staff.map((u, i) =>
      prisma.employee.upsert({
        where: { userId: u.id },
        create: {
          userId: u.id,
          employeeNumber: `LR-${String(i + 1).padStart(3, "0")}`,
          department: u.role.replace(/_/g, " ").toLowerCase(),
          hireDate: daysAgo(int(120, 1400)),
          employmentType: "FULL_TIME",
        },
        update: {},
      }),
    ),
  );

  // ── Tags ─────────────────────────────────────────────────────────────
  const tags = await Promise.all(
    TAGS.map((t) =>
      prisma.tag.upsert({
        where: { name: t.name },
        create: t,
        update: { color: t.color },
      }),
    ),
  );

  // ── Pipeline ─────────────────────────────────────────────────────────
  const pipeline = await prisma.pipeline.create({
    data: {
      name: "New Business",
      isDefault: true,
      stages: {
        create: [
          { name: "New", position: 0, color: "#94A3B8", winProbability: 10 },
          { name: "Contacted", position: 1, color: "#0EA5E9", winProbability: 25 },
          { name: "Qualified", position: 2, color: "#10AA99", winProbability: 45 },
          { name: "Proposal", position: 3, color: "#F59E0B", winProbability: 65 },
          { name: "Negotiation", position: 4, color: "#8B5CF6", winProbability: 80 },
          { name: "Won", position: 5, color: "#86BD3E", winProbability: 100 },
        ],
      },
    },
    include: { stages: { orderBy: { position: "asc" } } },
  });

  // ── Clients ──────────────────────────────────────────────────────────
  const clients: Array<
    Awaited<ReturnType<typeof prisma.client.create>> & {
      def: (typeof CLIENTS)[number];
    }
  > = [];

  for (const [i, def] of CLIENTS.entries()) {
    // A realistic book: mostly active, a few paused/inactive/churned.
    const status: ClientStatus =
      i < 18 ? "ACTIVE"
      : i < 20 ? "ONBOARDING"
      : i < 22 ? "PAUSED"
      : i < 24 ? "INACTIVE"
      : "CHURNED";

    const startedDaysAgo = int(60, 900);
    const slug = def.company
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const bareDomain = slug.replace(/-/g, "");

    const client = await prisma.client.create({
      data: {
        companyName: def.company,
        slug,
        ownerName: def.owner,
        contactPerson: def.owner,
        email: `hello@${bareDomain}.com`,
        phone: `(${int(200, 989)}) ${int(200, 999)}-${String(int(0, 9999)).padStart(4, "0")}`,
        website: `https://www.${bareDomain}.com`,
        businessCategory: def.category,
        addressLine1: `${int(100, 9899)} ${pick(["Main St", "Oak Ave", "Commerce Dr", "Market St", "Industrial Pkwy"])}`,
        city: def.city,
        state: def.state,
        zipCode: def.zip,
        country: def.state === "DU" ? "United Arab Emirates" : "United States",
        googleBusinessProfile: `https://maps.google.com/?cid=${int(10000000, 99999999)}`,
        facebookUrl: chance(0.8) ? `https://facebook.com/${slug}` : null,
        instagramUrl: chance(0.6) ? `https://instagram.com/${slug}` : null,
        linkedinUrl: chance(0.4) ? `https://linkedin.com/company/${slug}` : null,
        status,
        priority:
          status === "ACTIVE" && def.retainer > 2500
            ? "HIGH"
            : (pick(["LOW", "MEDIUM", "MEDIUM", "HIGH"]) as Priority),
        monthlyRetainer: def.retainer,
        startDate: daysAgo(startedDaysAgo),
        renewalDate: daysAhead(int(-20, 120)),
        accountManagerId: pick(managers).id,
        notes: chance(0.5)
          ? `${def.owner} prefers ${pick(["email", "phone", "text"])} contact. Reporting cadence: ${pick(["monthly", "bi-weekly"])}.`
          : null,
        createdAt: daysAgo(startedDaysAgo),
        services: {
          create: def.services.map((service) => ({
            service,
            monthlyFee: Math.round(def.retainer / def.services.length),
            startedAt: daysAgo(startedDaysAgo),
          })),
        },
        tags: { create: [{ tagId: pick(tags).id }] },
        contacts: {
          create: [
            {
              name: def.owner,
              role: "Owner",
              email: `owner@${bareDomain}.com`,
              isPrimary: true,
            },
          ],
        },
      },
    });
    clients.push({ ...client, def });
  }
  console.log(`   + ${clients.length} clients`);

  const activeClients = clients.filter((c) => c.status === "ACTIVE");

  // ── Subscriptions ────────────────────────────────────────────────────
  await Promise.all(
    activeClients.map((c) =>
      prisma.subscription.create({
        data: {
          clientId: c.id,
          name: `${c.def.company} - Monthly Retainer`,
          status: "ACTIVE",
          interval: "MONTHLY",
          amount: c.def.retainer,
          startDate: c.startDate!,
          currentPeriodStart: new Date(
            new Date().getFullYear(),
            new Date().getMonth(),
            1,
          ),
          currentPeriodEnd: new Date(
            new Date().getFullYear(),
            new Date().getMonth() + 1,
            0,
          ),
          nextInvoiceDate: daysAhead(int(1, 28)),
        },
      }),
    ),
  );

  // ── Projects, tasks, time entries ────────────────────────────────────
  const TASK_TITLES = [
    "Keyword research + mapping",
    "Publish GBP posts",
    "On-page optimisation pass",
    "Build citation batch",
    "Ad copy refresh",
    "Monthly report prep",
    "Technical SEO audit",
    "Landing page revisions",
    "Review response sweep",
    "Schema markup implementation",
    "Competitor gap analysis",
    "Content brief",
  ];

  let projectCount = 0;
  let taskCount = 0;

  for (const client of clients) {
    const nProjects = client.status === "ACTIVE" ? int(1, 3) : 1;

    for (let p = 0; p < nProjects; p++) {
      const type = pick([
        "SEO_CAMPAIGN",
        "GOOGLE_ADS_CAMPAIGN",
        "WEBSITE_BUILD",
        "GBP_OPTIMIZATION",
        "SOCIAL_MEDIA",
        "CONTENT",
      ] as ProjectType[]);

      const status: ProjectStatus =
        client.status !== "ACTIVE"
          ? "COMPLETED"
          : pick([
              "PLANNING",
              "IN_PROGRESS",
              "IN_PROGRESS",
              "IN_PROGRESS",
              "REVIEW",
              "COMPLETED",
            ] as ProjectStatus[]);

      const progress =
        status === "COMPLETED" ? 100
        : status === "REVIEW" ? int(80, 95)
        : status === "IN_PROGRESS" ? int(20, 75)
        : int(0, 15);

      const memberPool = [pick(managers), ...deliveryTeam.filter(() => chance(0.35))];
      const uniqueMembers = [...new Map(memberPool.map((m) => [m.id, m])).values()];

      const prettyType = type
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (m) => m.toUpperCase());

      const project = await prisma.project.create({
        data: {
          name: `${prettyType} - ${client.def.company}`,
          description: `${type.replace(/_/g, " ").toLowerCase()} engagement for ${client.def.company}.`,
          type,
          status,
          priority: pick(["LOW", "MEDIUM", "MEDIUM", "HIGH"]) as Priority,
          progress,
          clientId: client.id,
          budget: int(1500, 14000),
          startDate: daysAgo(int(30, 240)),
          dueDate: status === "COMPLETED" ? daysAgo(int(1, 40)) : daysAhead(int(5, 90)),
          completedAt: status === "COMPLETED" ? daysAgo(int(1, 40)) : null,
          ...(type === "WEBSITE_BUILD"
            ? {
                domain: client.slug.replace(/-/g, "") + ".com",
                hostingProvider: pick(["Vercel", "Cloudflare", "AWS"]),
                sslExpiresAt: daysAhead(int(30, 300)),
                liveUrl: client.website,
              }
            : {}),
          members: {
            create: uniqueMembers.map((m, idx) => ({
              userId: m.id,
              role: idx === 0 ? "Lead" : "Contributor",
            })),
          },
        },
      });
      projectCount++;

      for (let t = 0; t < int(3, 7); t++) {
        const taskStatus: TaskStatus =
          status === "COMPLETED"
            ? "DONE"
            : pick([
                "TODO",
                "TODO",
                "IN_PROGRESS",
                "IN_REVIEW",
                "DONE",
                "BLOCKED",
              ] as TaskStatus[]);

        // Roughly a fifth of open tasks land on today so the KPI is non-zero.
        const dueDate =
          taskStatus === "DONE"
            ? daysAgo(int(1, 30))
            : chance(0.2)
              ? new Date()
              : daysAhead(int(-4, 30));

        const assignee = pick([...deliveryTeam, ...managers]);

        const task = await prisma.task.create({
          data: {
            title: pick(TASK_TITLES),
            status: taskStatus,
            priority: pick(["LOW", "MEDIUM", "MEDIUM", "HIGH", "URGENT"]) as Priority,
            projectId: project.id,
            clientId: client.id,
            assigneeId: assignee.id,
            creatorId: pick(managers).id,
            dueDate,
            position: t,
            estimatedHours: int(1, 12),
            completedAt: taskStatus === "DONE" ? daysAgo(int(1, 25)) : null,
          },
        });
        taskCount++;

        if (taskStatus === "DONE" && chance(0.6)) {
          const started = daysAgo(int(1, 25));
          const minutes = int(30, 300);
          await prisma.timeEntry.create({
            data: {
              userId: assignee.id,
              taskId: task.id,
              description: "Delivery work",
              startedAt: started,
              endedAt: new Date(started.getTime() + minutes * 60_000),
              minutes,
              billable: true,
            },
          });
        }
      }
    }
  }
  console.log(`   + ${projectCount} projects, ${taskCount} tasks`);

  // ── Invoices + payments ──────────────────────────────────────────────
  let invoiceNo = 1000;
  let invoiceCount = 0;
  let paymentCount = 0;

  for (const client of clients) {
    const monthsBack = client.status === "ACTIVE" ? 14 : 8;

    for (let m = monthsBack; m >= 0; m--) {
      const issueDate = new Date();
      issueDate.setMonth(issueDate.getMonth() - m, 1);
      issueDate.setHours(9, 0, 0, 0);

      // Never invoice before the client started.
      if (client.startDate && issueDate < client.startDate) continue;
      // Non-active clients stopped being billed a few months ago.
      if (client.status !== "ACTIVE" && m < 3) continue;

      const dueDate = new Date(issueDate);
      dueDate.setDate(dueDate.getDate() + 15);

      const amount = client.def.retainer;
      const isCurrentMonth = m === 0;
      const isPastDue = dueDate < new Date();

      // Most invoices are paid; a few recent ones stay open/overdue.
      let status: InvoiceStatus;
      if (isCurrentMonth) status = chance(0.5) ? "SENT" : "PAID";
      else if (m === 1 && chance(0.25)) status = isPastDue ? "OVERDUE" : "SENT";
      else status = "PAID";

      const paidAt =
        status === "PAID"
          ? new Date(issueDate.getTime() + int(1, 14) * 86_400_000)
          : null;

      const perItem = Math.round(amount / client.def.services.length);

      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber: `INV-${++invoiceNo}`,
          clientId: client.id,
          status,
          issueDate,
          dueDate,
          sentAt: issueDate,
          subtotal: amount,
          taxRate: 0,
          taxAmount: 0,
          total: amount,
          amountPaid: status === "PAID" ? amount : 0,
          paidAt,
          remindersSent: status === "OVERDUE" ? int(1, 3) : 0,
          items: {
            create: client.def.services.map((service, idx) => ({
              description: service
                .replace(/_/g, " ")
                .toLowerCase()
                .replace(/\b\w/g, (c) => c.toUpperCase()),
              quantity: 1,
              unitPrice: perItem,
              amount: perItem,
              service,
              position: idx,
            })),
          },
        },
      });
      invoiceCount++;

      if (status === "PAID" && paidAt) {
        await prisma.payment.create({
          data: {
            invoiceId: invoice.id,
            amount,
            method: pick([
              "STRIPE_CARD",
              "STRIPE_ACH",
              "BANK_TRANSFER",
              "AUTHORIZE_NET",
            ] as PaymentMethod[]),
            status: "SUCCEEDED",
            paidAt,
            reference: `ch_${Math.random().toString(36).slice(2, 14)}`,
          },
        });
        paymentCount++;
      }
    }
  }
  console.log(`   + ${invoiceCount} invoices, ${paymentCount} payments`);

  // ── SEO keywords + 90 days of rankings ───────────────────────────────
  let keywordCount = 0;
  let rankingCount = 0;

  const seoClients = clients.filter((c) =>
    c.def.services.some((s) => s === "LOCAL_SEO" || s === "NATIONAL_SEO"),
  );

  for (const client of seoClients) {
    const term = client.def.category.toLowerCase();

    for (const template of KEYWORD_TEMPLATES.slice(0, int(3, 6))) {
      const keyword = await prisma.seoKeyword.create({
        data: {
          clientId: client.id,
          keyword: template(term),
          location: `${client.def.city}, ${client.def.state}`,
          searchVolume: int(40, 3200),
          difficulty: int(8, 72),
          isPrimary: chance(0.3),
          targetUrl: client.website,
        },
      });
      keywordCount++;

      // Walk the position downward over time so charts show improvement.
      let position = int(14, 42);
      const rankings: Prisma.SeoRankingCreateManyInput[] = [];

      for (let d = 90; d >= 0; d -= 3) {
        const previous = position;
        position = Math.max(1, position + (chance(0.62) ? -int(0, 2) : int(0, 1)));
        const capturedAt = daysAgo(d);
        capturedAt.setHours(9, 0, 0, 0);
        rankings.push({
          keywordId: keyword.id,
          position,
          previousPosition: previous,
          url: client.website,
          mapPackPosition: position <= 10 ? Math.min(3, Math.ceil(position / 3)) : null,
          capturedAt,
        });
      }
      await prisma.seoRanking.createMany({ data: rankings, skipDuplicates: true });
      rankingCount += rankings.length;
    }
  }
  console.log(`   + ${keywordCount} keywords, ${rankingCount} ranking snapshots`);

  // ── GBP insights (last 6 months) ─────────────────────────────────────
  for (const client of activeClients) {
    for (let m = 5; m >= 0; m--) {
      const periodStart = new Date();
      periodStart.setMonth(periodStart.getMonth() - m, 1);
      periodStart.setHours(0, 0, 0, 0);
      const periodEnd = new Date(periodStart);
      periodEnd.setMonth(periodEnd.getMonth() + 1, 0);

      const growth = 1 + (5 - m) * 0.08;
      await prisma.gbpInsight.create({
        data: {
          clientId: client.id,
          periodStart,
          periodEnd,
          searchViews: Math.round(int(900, 5200) * growth),
          mapViews: Math.round(int(600, 4100) * growth),
          websiteClicks: Math.round(int(60, 480) * growth),
          phoneCalls: Math.round(int(20, 190) * growth),
          directionRequests: Math.round(int(15, 160) * growth),
          bookings: int(0, 22),
          photoViews: int(200, 2600),
          totalReviews: int(18, 240),
          averageRating: Number((4.2 + rand() * 0.8).toFixed(1)),
          newReviews: int(0, 14),
          postsPublished: int(2, 12),
          questionsAnswered: int(0, 6),
        },
      });
    }
  }

  // ── Ads campaigns ────────────────────────────────────────────────────
  const adsClients = clients.filter((c) =>
    c.def.services.some((s) => s === "GOOGLE_ADS" || s === "META_ADS"),
  );

  for (const client of adsClients) {
    const platforms: AdPlatform[] = client.def.services.includes("META_ADS")
      ? ["GOOGLE_ADS", "META_ADS"]
      : ["GOOGLE_ADS"];

    for (const platform of platforms) {
      const clicks = int(320, 4200);
      const cost = int(600, 5200);
      await prisma.adsCampaign.create({
        data: {
          clientId: client.id,
          platform,
          name: `${client.def.category} - ${platform === "GOOGLE_ADS" ? "Search" : "Lead Gen"}`,
          status: client.status === "ACTIVE" ? "ACTIVE" : "PAUSED",
          budgetDaily: Math.round(cost / 30),
          budgetMonthly: cost,
          impressions: clicks * int(12, 40),
          clicks,
          conversions: Math.round(clicks * (0.03 + rand() * 0.07)),
          cost,
          // Profitable on average, but not uniformly - ROI needs to be real.
          revenue: Math.round(cost * (1.4 + rand() * 2.6)),
          startDate: daysAgo(int(60, 400)),
        },
      });
    }
  }

  // ── Social posts ─────────────────────────────────────────────────────
  for (const client of clients.filter((c) => c.def.services.includes("SOCIAL_MEDIA"))) {
    for (let i = 0; i < int(4, 10); i++) {
      const published = chance(0.7);
      await prisma.socialPost.create({
        data: {
          clientId: client.id,
          platform: pick([
            "FACEBOOK",
            "INSTAGRAM",
            "LINKEDIN",
            "GOOGLE_BUSINESS",
          ] as SocialPlatform[]),
          status: published ? "PUBLISHED" : "SCHEDULED",
          content: pick([
            `Proud to serve ${client.def.city}! Book your free estimate today.`,
            `5-star review just in - thank you for trusting ${client.def.company}.`,
            `Tips from our team on choosing the right ${client.def.category.toLowerCase()} provider.`,
            `We're hiring! Join the ${client.def.company} team.`,
          ]),
          publishedAt: published ? daysAgo(int(1, 60)) : null,
          scheduledFor: published ? null : daysAhead(int(1, 21)),
          likes: published ? int(2, 180) : 0,
          comments: published ? int(0, 24) : 0,
          shares: published ? int(0, 15) : 0,
          reach: published ? int(80, 4200) : 0,
        },
      });
    }
  }

  // ── Leads (12 months, trending up) ───────────────────────────────────
  const LEAD_COMPANIES = [
    "Apex Window Cleaning", "Bluewater Marine", "Cedar Ridge Builders", "Dynamo Electric",
    "Evergreen Tree Care", "Fairview Dentistry", "Granite State Paving", "Horizon Med Spa",
    "Ivy League Tutoring", "Jetstream Appliance", "Keystone Locksmith", "Lakefront Interiors",
    "Momentum Physical Therapy", "Northstar Security", "Oakwood Flooring", "Pinnacle Painting",
    "Quarry Stone Masonry", "Riverside Plumbing", "Silverline Gutters", "Trailhead Outfitters",
    "Urban Edge Barbers", "Valley Fresh Produce", "Westgate Auto Glass", "Yellowbrick Daycare",
    "Zenith Roofing Co", "Anchor Bay Charters", "Brightpath Accounting", "Copperfield Landscaping",
  ];

  const stageFor = (status: LeadStatus) => {
    const name =
      status === "WON" ? "Won"
      : status === "NEW" ? "New"
      : status === "CONTACTED" ? "Contacted"
      : status === "QUALIFIED" ? "Qualified"
      : status === "PROPOSAL_SENT" ? "Proposal"
      : "Negotiation";
    return pipeline.stages.find((s) => s.name === name) ?? pipeline.stages[0]!;
  };

  let leadCount = 0;
  for (let m = 11; m >= 0; m--) {
    // Trend upward toward recent months so the chart reads as growth.
    const perMonth = int(3, 6) + Math.round((11 - m) * 0.4);

    for (let i = 0; i < perMonth; i++) {
      const createdAt = new Date();
      createdAt.setMonth(createdAt.getMonth() - m, int(1, 28));

      const status = pick([
        "NEW", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT",
        "NEGOTIATION", "WON", "WON", "LOST",
      ] as LeadStatus[]);

      const closed = status === "WON" || status === "LOST";

      await prisma.lead.create({
        data: {
          companyName: `${pick(LEAD_COMPANIES)} ${int(2, 99)}`,
          contactName: `${pick(["Jordan", "Casey", "Morgan", "Taylor", "Avery", "Quinn"])} ${pick(["Smith", "Nguyen", "Okoro", "Rossi", "Kim"])}`,
          email: `lead${leadCount}@example.com`,
          phone: `(${int(200, 989)}) ${int(200, 999)}-${String(int(0, 9999)).padStart(4, "0")}`,
          city: pick(["Hicksville", "Levittown", "Garden City", "Westbury", "Plainview"]),
          state: "NY",
          status,
          source: pick([
            "WEBSITE", "GOOGLE_ADS", "ORGANIC_SEARCH",
            "REFERRAL", "SOCIAL_MEDIA", "COLD_OUTREACH",
          ] as LeadSource[]),
          priority: pick(["LOW", "MEDIUM", "HIGH"]) as Priority,
          estimatedValue: int(800, 6000),
          pipelineId: pipeline.id,
          stageId: stageFor(status).id,
          ownerId: pick(managers).id,
          position: i,
          createdAt,
          contactedAt: status !== "NEW" ? createdAt : null,
          closedAt: closed ? createdAt : null,
          lostReason:
            status === "LOST"
              ? pick(["Budget", "Went with competitor", "No response", "Timing"])
              : null,
        },
      });
      leadCount++;
    }
  }
  console.log(`   + ${leadCount} leads`);

  // ── Meetings ─────────────────────────────────────────────────────────
  for (const client of activeClients.slice(0, 16)) {
    const startsAt = daysAhead(int(1, 30));
    startsAt.setHours(int(9, 16), pick([0, 30]), 0, 0);
    const host = pick(managers);

    await prisma.meeting.create({
      data: {
        title: `${client.def.company} - Monthly Review`,
        description: "Performance review and next-month plan.",
        status: "SCHEDULED",
        startsAt,
        endsAt: new Date(startsAt.getTime() + 45 * 60_000),
        provider: "google_meet",
        meetingUrl: `https://meet.google.com/${Math.random().toString(36).slice(2, 5)}-${Math.random().toString(36).slice(2, 6)}`,
        clientId: client.id,
        attendees: {
          create: [{ userId: host.id, accepted: true, name: host.name }],
        },
      },
    });
  }

  // ── Support tickets ──────────────────────────────────────────────────
  let ticketNo = 500;
  for (const client of activeClients.slice(0, 12)) {
    await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-${++ticketNo}`,
        subject: pick([
          "Need updated hours on Google",
          "Website contact form not sending",
          "Request: add new service page",
          "Question about this month's invoice",
          "Photos need refreshing on GBP",
        ]),
        description: "Submitted from the client portal.",
        status: pick(["OPEN", "IN_PROGRESS", "WAITING_ON_CLIENT", "RESOLVED"]),
        priority: pick(["LOW", "MEDIUM", "HIGH"]) as Priority,
        clientId: client.id,
        assigneeId: pick(deliveryTeam).id,
        createdAt: daysAgo(int(1, 45)),
      },
    });
  }

  // ── Client-portal users ──────────────────────────────────────────────
  const portalClients = activeClients.slice(0, 5);
  await Promise.all(
    portalClients.map((c, i) =>
      prisma.user.upsert({
        where: { email: `client${i + 1}@example.com` },
        create: {
          name: c.def.owner,
          email: `client${i + 1}@example.com`,
          passwordHash,
          role: "CLIENT",
          status: "ACTIVE",
          emailVerified: new Date(),
          clientId: c.id,
        },
        update: { clientId: c.id, passwordHash },
      }),
    ),
  );
  console.log(`   + ${portalClients.length} client-portal users`);

  // ── Notifications ────────────────────────────────────────────────────
  for (const user of staff.slice(0, 4)) {
    for (let i = 0; i < int(3, 6); i++) {
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: pick([
            "TASK_ASSIGNED", "INVOICE_PAID", "MEETING_REMINDER",
            "RENEWAL_UPCOMING", "TICKET_UPDATE",
          ]),
          title: pick([
            "New task assigned to you",
            "Invoice paid",
            "Meeting in 30 minutes",
            "Client renewal in 14 days",
            "Ticket reply received",
          ]),
          body: pick([
            "Check the client workspace for details.",
            "Payment cleared successfully.",
            "Join via the calendar link.",
          ]),
          link: "/dashboard",
          readAt: chance(0.4) ? daysAgo(int(0, 3)) : null,
          createdAt: daysAgo(int(0, 10)),
        },
      });
    }
  }

  // ── Audit trail ──────────────────────────────────────────────────────
  for (let i = 0; i < 40; i++) {
    const actor = pick(staff);
    const client = pick(clients);
    await prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: pick([
          "CREATE", "UPDATE", "UPDATE", "UPDATE", "DELETE", "LOGIN", "EXPORT",
        ]),
        entity: "Client",
        entityId: client.id,
        summary: pick([
          `updated client ${client.def.company}`,
          `created an invoice for ${client.def.company}`,
          `completed a task for ${client.def.company}`,
          `exported the client list`,
          `signed in`,
        ]),
        ipAddress: `${int(10, 199)}.${int(0, 255)}.${int(0, 255)}.${int(1, 254)}`,
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0",
        createdAt: daysAgo(int(0, 14)),
      },
    });
  }

  // ── Settings ─────────────────────────────────────────────────────────
  const settings: Array<[string, Prisma.InputJsonValue, string]> = [
    ["company.name", "Local Rankers LLC", "general"],
    ["company.email", "thelocalrankers@gmail.com", "general"],
    ["company.phone", "(516) 585-6503", "general"],
    ["company.address", "Hicksville, NY 11801", "general"],
    ["company.website", "https://thelocalrankers.com", "general"],
    ["branding.primaryColor", "#86BD3E", "branding"],
    ["branding.secondaryColor", "#10AA99", "branding"],
    ["branding.navyColor", "#152A3A", "branding"],
    ["branding.logoUrl", "/images/logo.png", "branding"],
    ["billing.currency", "USD", "billing"],
    ["billing.taxRate", 0, "billing"],
    ["billing.paymentTermsDays", 15, "billing"],
    ["billing.lateFeePercent", 1.5, "billing"],
    ["automation.reminderDays", [3, 7, 14], "automation"],
    ["locale.timezone", "America/New_York", "general"],
  ];

  await Promise.all(
    settings.map(([key, value, category]) =>
      prisma.setting.upsert({
        where: { key },
        create: { key, value, category },
        update: { value, category },
      }),
    ),
  );

  console.log("\n  Seed complete.\n");
  console.log("  Sign in with any of these (all share one password):");
  console.log(`  Password: ${DEMO_PASSWORD}\n`);
  for (const person of STAFF) {
    console.log(`    ${person.email.padEnd(34)} ${person.role}`);
  }
  console.log(`    client1@example.com                CLIENT (portal)\n`);
}

main()
  .catch((e) => {
    console.error("\n  Seed failed:\n", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
