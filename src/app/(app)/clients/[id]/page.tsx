import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import {
  Building2,
  Calendar,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  Phone,
  User,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getClientById } from "@/lib/queries/clients";
import { formatCurrency, initials } from "@/lib/utils";
import {
  CLIENT_STATUS_LABELS,
  PRIORITY_BADGE_VARIANT,
  PRIORITY_LABELS,
  SERVICE_LABELS,
  STATUS_BADGE_VARIANT,
} from "@/lib/validations/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const client = await getClientById(id);
  return { title: client?.companyName ?? "Client" };
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [session, client] = await Promise.all([auth(), getClientById(id)]);

  if (!client) notFound();

  const role = session?.user.role;
  const address = [
    client.addressLine1,
    client.addressLine2,
    [client.city, client.state, client.zipCode].filter(Boolean).join(", "),
    client.country,
  ]
    .filter(Boolean)
    .join("\n");

  const socials = (
    [
      ["Google Business", client.googleBusinessProfile],
      ["Facebook", client.facebookUrl],
      ["Instagram", client.instagramUrl],
      ["LinkedIn", client.linkedinUrl],
      ["YouTube", client.youtubeUrl],
      ["TikTok", client.tiktokUrl],
      ["X / Twitter", client.twitterUrl],
    ] as const
  ).filter(([, url]) => !!url);

  const outstanding = client.invoices.reduce(
    (sum, inv) => sum + (Number(inv.total) - Number(inv.amountPaid)),
    0,
  );

  return (
    <>
      <PageHeader
        title={client.companyName}
        description={
          [client.businessCategory, client.city, client.state]
            .filter(Boolean)
            .join(" · ") || undefined
        }
        actions={
          <>
            {client.website && (
              <Button variant="outline" asChild>
                <a href={client.website} target="_blank" rel="noopener noreferrer">
                  <Globe />
                  <span className="hidden sm:inline">Visit site</span>
                </a>
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link href="/clients">Back to list</Link>
            </Button>
          </>
        }
      />

      {/* Status strip */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge variant={STATUS_BADGE_VARIANT[client.status]}>
          {CLIENT_STATUS_LABELS[client.status]}
        </Badge>
        <Badge variant={PRIORITY_BADGE_VARIANT[client.priority]}>
          {PRIORITY_LABELS[client.priority]} priority
        </Badge>
        {client.monthlyRetainer && (
          <Badge variant="outline">
            {formatCurrency(Number(client.monthlyRetainer))}/mo retainer
          </Badge>
        )}
        {client.renewalDate && (
          <Badge variant="outline">
            Renews {format(client.renewalDate, "MMM d, yyyy")}
          </Badge>
        )}
        {client.tags.map(({ tag }) => (
          <Badge
            key={tag.id}
            variant="outline"
            style={{ borderColor: tag.color, color: tag.color }}
          >
            {tag.name}
          </Badge>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoRow icon={User} label="Owner" value={client.ownerName} />
              <InfoRow
                icon={User}
                label="Primary contact"
                value={client.contactPerson}
              />
              <InfoRow
                icon={Mail}
                label="Email"
                value={client.email}
                href={client.email ? `mailto:${client.email}` : undefined}
              />
              <InfoRow
                icon={Phone}
                label="Phone"
                value={client.phone}
                href={client.phone ? `tel:${client.phone}` : undefined}
              />
              <InfoRow
                icon={Globe}
                label="Website"
                value={client.website}
                href={client.website ?? undefined}
              />
              <InfoRow
                icon={MapPin}
                label="Address"
                value={address || null}
                multiline
              />
            </CardContent>
          </Card>

          {socials.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Profiles</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {socials.map(([label, url]) => (
                  <a
                    key={label}
                    href={url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-sm px-1 py-1.5 text-sm transition-colors hover:bg-muted"
                  >
                    <span>{label}</span>
                    <ExternalLink className="size-3.5 text-muted-foreground" />
                  </a>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Account manager</p>
                {client.accountManager ? (
                  <div className="mt-1.5 flex items-center gap-2">
                    <Avatar className="size-7">
                      {client.accountManager.image && (
                        <AvatarImage src={client.accountManager.image} alt="" />
                      )}
                      <AvatarFallback className="text-[10px]">
                        {initials(client.accountManager.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {client.accountManager.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {client.accountManager.email}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">Unassigned</p>
                )}
              </div>
              <Separator />
              <InfoRow
                icon={Calendar}
                label="Client since"
                value={
                  client.startDate
                    ? format(client.startDate, "MMMM d, yyyy")
                    : format(client.createdAt, "MMMM d, yyyy")
                }
              />
              <InfoRow
                icon={Building2}
                label="Category"
                value={client.businessCategory}
              />
            </CardContent>
          </Card>

          {client.services.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Services</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-1.5">
                {client.services.map((s) => (
                  <Badge key={s.id} variant={s.isActive ? "default" : "muted"}>
                    {SERVICE_LABELS[s.service]}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Tabs */}
        <div className="min-w-0">
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Projects" value={client._count.projects} />
            <StatTile label="Open tasks" value={client.tasks.length} />
            <StatTile label="Invoices" value={client._count.invoices} />
            <StatTile
              label="Outstanding"
              value={formatCurrency(outstanding)}
              accent={outstanding > 0}
            />
          </div>

          <Tabs defaultValue="overview">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="projects">
                Projects ({client.projects.length})
              </TabsTrigger>
              <TabsTrigger value="tasks">
                Tasks ({client.tasks.length})
              </TabsTrigger>
              <TabsTrigger value="invoices">
                Invoices ({client.invoices.length})
              </TabsTrigger>
              <TabsTrigger value="files">
                Files ({client.files.length})
              </TabsTrigger>
              <TabsTrigger value="team">Team</TabsTrigger>
              {can(role, "audit:read") && (
                <TabsTrigger value="activity">Activity</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="overview">
              <Card>
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  {client.notes ? (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {client.notes}
                    </p>
                  ) : (
                    <Empty message="No notes yet." />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="projects">
              <Card>
                <CardContent className="pt-6">
                  {client.projects.length === 0 ? (
                    <Empty message="No projects yet." />
                  ) : (
                    <ul className="divide-y divide-border">
                      {client.projects.map((p) => (
                        <li key={p.id} className="py-3 first:pt-0 last:pb-0">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">
                                {p.name}
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {p.type.replace(/_/g, " ").toLowerCase()}
                                {p.dueDate &&
                                  ` · due ${format(p.dueDate, "MMM d, yyyy")}`}
                              </p>
                              <div className="mt-2 flex items-center gap-2">
                                <Progress value={p.progress} className="h-1.5 max-w-40" />
                                <span className="tabular text-xs text-muted-foreground">
                                  {p.progress}%
                                </span>
                              </div>
                            </div>
                            <Badge variant="outline" className="shrink-0">
                              {p.status.replace(/_/g, " ").toLowerCase()}
                            </Badge>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tasks">
              <Card>
                <CardContent className="pt-6">
                  {client.tasks.length === 0 ? (
                    <Empty message="No open tasks." />
                  ) : (
                    <ul className="divide-y divide-border">
                      {client.tasks.map((t) => (
                        <li
                          key={t.id}
                          className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {t.title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {t.dueDate
                                ? `Due ${format(t.dueDate, "MMM d")}`
                                : "No due date"}
                            </p>
                          </div>
                          <Badge
                            variant={PRIORITY_BADGE_VARIANT[t.priority]}
                            className="shrink-0"
                          >
                            {PRIORITY_LABELS[t.priority]}
                          </Badge>
                          {t.assignee && (
                            <Avatar className="size-6 shrink-0">
                              {t.assignee.image && (
                                <AvatarImage src={t.assignee.image} alt="" />
                              )}
                              <AvatarFallback className="text-[9px]">
                                {initials(t.assignee.name)}
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="invoices">
              <Card>
                <CardContent className="pt-6">
                  {client.invoices.length === 0 ? (
                    <Empty message="No invoices yet." />
                  ) : (
                    <ul className="divide-y divide-border">
                      {client.invoices.map((inv) => (
                        <li
                          key={inv.id}
                          className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">
                              {inv.invoiceNumber}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Issued {format(inv.issueDate, "MMM d, yyyy")} · due{" "}
                              {format(inv.dueDate, "MMM d, yyyy")}
                            </p>
                          </div>
                          <span className="tabular shrink-0 text-sm font-medium">
                            {formatCurrency(Number(inv.total))}
                          </span>
                          <Badge
                            variant={
                              inv.status === "PAID"
                                ? "success"
                                : inv.status === "OVERDUE"
                                  ? "danger"
                                  : "muted"
                            }
                            className="shrink-0"
                          >
                            {inv.status.replace(/_/g, " ").toLowerCase()}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="files">
              <Card>
                <CardContent className="pt-6">
                  {client.files.length === 0 ? (
                    <Empty message="No files uploaded." />
                  ) : (
                    <ul className="divide-y divide-border">
                      {client.files.map((f) => (
                        <li
                          key={f.id}
                          className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {f.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {f.category.toLowerCase()} ·{" "}
                              {format(f.createdAt, "MMM d, yyyy")}
                              {f.uploadedBy?.name && ` · ${f.uploadedBy.name}`}
                            </p>
                          </div>
                          <Button variant="ghost" size="icon-sm" asChild>
                            <a
                              href={f.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Open ${f.name}`}
                            >
                              <ExternalLink />
                            </a>
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="team">
              <Card>
                <CardContent className="pt-6">
                  {client.team.length === 0 ? (
                    <Empty message="Nobody assigned to this client's projects yet." />
                  ) : (
                    <ul className="grid gap-3 sm:grid-cols-2">
                      {client.team.map((member) => (
                        <li key={member.id} className="flex items-center gap-3">
                          <Avatar>
                            {member.image && (
                              <AvatarImage src={member.image} alt="" />
                            )}
                            <AvatarFallback>
                              {initials(member.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {member.name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {member.role.replace(/_/g, " ").toLowerCase()}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {can(role, "audit:read") && (
              <TabsContent value="activity">
                <Card>
                  <CardContent className="pt-6">
                    {client.activity.length === 0 ? (
                      <Empty message="No changes recorded yet." />
                    ) : (
                      <ul className="space-y-4">
                        {client.activity.map((entry) => (
                          <li key={entry.id} className="flex gap-3">
                            <Avatar className="size-7 shrink-0">
                              {entry.user?.image && (
                                <AvatarImage src={entry.user.image} alt="" />
                              )}
                              <AvatarFallback className="text-[10px]">
                                {initials(entry.user?.name ?? "?")}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm">
                                <span className="font-medium">
                                  {entry.user?.name ?? "System"}
                                </span>{" "}
                                <span className="text-muted-foreground">
                                  {entry.summary ?? entry.action.toLowerCase()}
                                </span>
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground/80">
                                {formatDistanceToNow(entry.createdAt, {
                                  addSuffix: true,
                                })}
                                {entry.ipAddress && ` · ${entry.ipAddress}`}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    </>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  href,
  multiline,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null | undefined;
  href?: string;
  multiline?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        {href ? (
          <a
            href={href}
            target={href.startsWith("http") ? "_blank" : undefined}
            rel="noopener noreferrer"
            className="break-words text-sm text-accent hover:underline"
          >
            {value}
          </a>
        ) : (
          <p
            className={
              multiline
                ? "whitespace-pre-line break-words text-sm"
                : "break-words text-sm"
            }
          >
            {value}
          </p>
        )}
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`tabular mt-1 font-display text-xl font-semibold ${
          accent ? "text-destructive" : ""
        }`}
      >
        {value}
      </p>
    </Card>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <p className="py-10 text-center text-sm text-muted-foreground">{message}</p>
  );
}
