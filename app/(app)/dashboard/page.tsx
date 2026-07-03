"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  MessageSquare,
  Timer,
} from "lucide-react";
import { useWorkspace } from "@/lib/workspace";
import { PageHeader, Section } from "@/components/ui/misc";
import { StageBadge, PriorityDot } from "@/components/ui/chips";
import { Avatar } from "@/components/ui/Avatar";
import { money, shortMoney, formatDateRange, formatTime, relativeTime, isOverdue, isToday, daysUntil } from "@/lib/format";
import { SERVICE_LABELS, TASK_TYPE_LABELS } from "@/lib/labels";

export default function DashboardPage() {
  const ws = useWorkspace();
  const { data, currentUser } = ws;
  const m = ws.metrics();

  const metricCards = [
    { label: "New enquiries", value: String(m.newEnquiries), href: "/pipeline?stage=new", hint: "Not yet actioned" },
    { label: "Quotations awaiting reply", value: String(m.quotationsAwaiting), href: "/quotations?status=awaiting", hint: "Sent or viewed" },
    { label: "Follow-ups due today", value: String(m.followUpsDueToday), href: "/tasks?due=today", hint: "Across the team" },
    { label: "Confirmed bookings this month", value: String(m.confirmedThisMonth), href: "/bookings", hint: "New bookings" },
    { label: "Outstanding balances", value: shortMoney(m.outstandingBalance), href: "/bookings?filter=outstanding", hint: "Owed by customers" },
    { label: "Gross profit this month", value: shortMoney(m.grossProfitThisMonth), href: "/reports", hint: "Selling − cost" },
  ];

  // Needs attention: prioritised issues.
  const needsAttention = useMemo(() => {
    const items: { id: string; icon: "overdue" | "whatsapp" | "expiry" | "payment" | "depart"; text: string; href: string; sub: string }[] = [];
    for (const t of data.tasks.filter((t) => !t.done && isOverdue(t.dueAt))) {
      const c = data.customers.find((x) => x.id === t.customerId);
      items.push({ id: `t-${t.id}`, icon: "overdue", text: t.title, sub: `Overdue follow-up${c ? ` · ${c.name}` : ""}`, href: t.enquiryId ? `/enquiries/${t.enquiryId}` : "/tasks" });
    }
    for (const conv of data.conversations.filter((c) => c.unreadCount > 0)) {
      items.push({ id: `c-${conv.id}`, icon: "whatsapp", text: `Unanswered WhatsApp from ${conv.displayName}`, sub: `${conv.unreadCount} unread message${conv.unreadCount > 1 ? "s" : ""}`, href: "/whatsapp" });
    }
    for (const q of data.quotations.filter((q) => (q.status === "sent" || q.status === "viewed") && daysUntil(q.validUntil) <= 5)) {
      const c = data.customers.find((x) => x.id === q.customerId);
      const d = daysUntil(q.validUntil);
      items.push({ id: `q-${q.id}`, icon: "expiry", text: `${q.ref} expiring ${d < 0 ? "— expired" : d === 0 ? "today" : `in ${d}d`}`, sub: `${c?.name ?? ""} · ${q.destination}`, href: `/quotations/${q.id}` });
    }
    for (const b of data.bookings.filter((b) => b.status === "awaiting-payment" && b.amountPaid < b.totalSelling)) {
      const c = data.customers.find((x) => x.id === b.customerId);
      items.push({ id: `b-${b.id}`, icon: "payment", text: `Payment outstanding on ${b.ref}`, sub: `${c?.name ?? ""} · ${money(b.totalSelling - b.amountPaid)}`, href: `/bookings/${b.id}` });
    }
    for (const b of data.bookings.filter((b) => b.status !== "cancelled" && b.status !== "travel-completed" && daysUntil(b.travelStartDate) <= 21 && b.status !== "fully-confirmed")) {
      const c = data.customers.find((x) => x.id === b.customerId);
      items.push({ id: `d-${b.id}`, icon: "depart", text: `${b.ref} departs in ${daysUntil(b.travelStartDate)}d — not fully confirmed`, sub: `${c?.name ?? ""} · ${b.destination}`, href: `/bookings/${b.id}` });
    }
    return items.slice(0, 8);
  }, [data]);

  const myTasksToday = data.tasks
    .filter((t) => !t.done && t.assignedToId === currentUser.id && (isToday(t.dueAt) || isOverdue(t.dueAt)))
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));

  const recentEnquiries = [...data.enquiries]
    .filter((e) => e.status === "open")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 6);

  const attentionIcon = {
    overdue: <Timer className="size-4 text-warning" aria-hidden />,
    whatsapp: <MessageSquare className="size-4 text-info" aria-hidden />,
    expiry: <AlertTriangle className="size-4 text-warning" aria-hidden />,
    payment: <AlertTriangle className="size-4 text-error" aria-hidden />,
    depart: <CalendarClock className="size-4 text-warning" aria-hidden />,
  };

  return (
    <div className="space-y-7">
      <PageHeader
        title={`Good day, ${currentUser.name.split(" ")[0]}`}
        subtitle="Here's what needs your attention across the business today."
      />

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {metricCards.map((c) => (
          <Link key={c.label} href={c.href} className="card row-hover block p-4 transition-colors">
            <p className="text-[11px] font-semibold uppercase leading-tight tracking-wide text-muted">{c.label}</p>
            <p className="tnum mt-2 text-2xl font-bold">{c.value}</p>
            <p className="mt-1 text-[11px] text-muted">{c.hint}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Needs attention */}
        <Section title="Needs attention">
          <div className="card divide-y divide-line">
            {needsAttention.length === 0 ? (
              <p className="p-5 text-sm text-muted">Nothing urgent — you&apos;re all caught up.</p>
            ) : (
              needsAttention.map((item) => (
                <Link key={item.id} href={item.href} className="row-hover flex items-start gap-3 p-3.5">
                  <span className="mt-0.5">{attentionIcon[item.icon]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{item.text}</span>
                    <span className="block truncate text-xs text-muted">{item.sub}</span>
                  </span>
                  <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
                </Link>
              ))
            )}
          </div>
        </Section>

        {/* My tasks today */}
        <Section title="My tasks today" action={<Link href="/tasks" className="text-xs font-semibold text-terracotta">View all</Link>}>
          <div className="card divide-y divide-line">
            {myTasksToday.length === 0 ? (
              <p className="p-5 text-sm text-muted">No tasks due today. Nice.</p>
            ) : (
              myTasksToday.map((t) => {
                const c = data.customers.find((x) => x.id === t.customerId);
                return (
                  <div key={t.id} className="flex items-start gap-3 p-3.5">
                    <button
                      type="button"
                      onClick={() => ws.toggleTask(t.id)}
                      className="mt-0.5 size-4 shrink-0 rounded border border-muted"
                      aria-label={`Mark "${t.title}" done`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.title}</p>
                      <p className="truncate text-xs text-muted">
                        {TASK_TYPE_LABELS[t.type]}
                        {c ? ` · ${c.name}` : ""}
                        {" · "}
                        <span className={isOverdue(t.dueAt) ? "font-semibold text-warning" : ""}>
                          {isOverdue(t.dueAt) ? "Overdue" : `Due ${formatTime(t.dueAt)}`}
                        </span>
                      </p>
                    </div>
                    <PriorityDot priority={t.priority} />
                  </div>
                );
              })
            )}
          </div>
        </Section>
      </div>

      {/* Recent enquiries */}
      <Section title="Recent enquiries" action={<Link href="/pipeline" className="text-xs font-semibold text-terracotta">Open pipeline</Link>}>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-2.5 font-semibold">Customer</th>
                  <th className="px-4 py-2.5 font-semibold">Destination</th>
                  <th className="px-4 py-2.5 font-semibold">Travel dates</th>
                  <th className="px-4 py-2.5 font-semibold">Service</th>
                  <th className="px-4 py-2.5 font-semibold">Consultant</th>
                  <th className="px-4 py-2.5 font-semibold">Stage</th>
                  <th className="px-4 py-2.5 font-semibold">Last activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {recentEnquiries.map((e) => {
                  const c = data.customers.find((x) => x.id === e.customerId);
                  const consultant = data.users.find((u) => u.id === e.assignedConsultantId);
                  return (
                    <tr key={e.id} className="row-hover">
                      <td className="px-4 py-3">
                        <Link href={`/enquiries/${e.id}`} className="font-medium hover:text-terracotta">
                          {c?.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted">{e.destination}</td>
                      <td className="px-4 py-3 text-muted">{formatDateRange(e.travelStartDate, e.travelEndDate)}</td>
                      <td className="px-4 py-3 text-muted">{SERVICE_LABELS[e.service]}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          <Avatar initials={consultant?.initials ?? "?"} seed={consultant?.id} size={20} />
                          <span className="text-muted">{consultant?.name.split(" ")[0]}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3"><StageBadge stage={e.stage} /></td>
                      <td className="px-4 py-3 text-muted">{relativeTime(e.updatedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Section>
    </div>
  );
}
