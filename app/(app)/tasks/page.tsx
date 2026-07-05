"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useWorkspace } from "@/lib/workspace";
import { PageHeader } from "@/components/ui/misc";
import { PriorityDot } from "@/components/ui/chips";
import { useCreateModals } from "@/components/forms/CreateModals";
import { TASK_TYPE_LABELS } from "@/lib/labels";
import { formatDate, formatTime, isOverdue, isToday } from "@/lib/format";

export default function TasksPage() {
  const ws = useWorkspace();
  const { data, currentUser } = ws;
  const { openCreate } = useCreateModals();
  const searchParams = useSearchParams();
  const initialDueToday = searchParams.get("due") === "today";
  const highlightTaskId = searchParams.get("task");
  // Admins oversee the team, so default them to All tasks (My tasks is empty for
  // them and would contradict the dashboard's team-wide "due today" count).
  // A deep-linked task also shows across the team so it's always reachable.
  const [scope, setScope] = useState<"mine" | "all">(
    initialDueToday || highlightTaskId || currentUser.role === "admin" ? "all" : "mine",
  );
  const [show, setShow] = useState<"open" | "done">("open");
  const [dueTodayOnly, setDueTodayOnly] = useState(initialDueToday);

  useEffect(() => {
    if (!highlightTaskId) return;
    document.getElementById(`task-${highlightTaskId}`)?.scrollIntoView({ block: "center" });
  }, [highlightTaskId]);

  const tasks = useMemo(() => {
    return data.tasks
      .filter((t) => (scope === "mine" ? t.assignedToId === currentUser.id : true))
      .filter((t) => (show === "open" ? !t.done : t.done))
      .filter((t) => (dueTodayOnly ? isToday(t.dueAt) : true))
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  }, [data.tasks, scope, show, dueTodayOnly, currentUser.id]);

  const overdue = tasks.filter((t) => !t.done && isOverdue(t.dueAt));
  const today = tasks.filter((t) => !t.done && isToday(t.dueAt));
  const upcoming = tasks.filter((t) => !t.done && !isOverdue(t.dueAt) && !isToday(t.dueAt));

  const groups = show === "open"
    ? [{ label: "Overdue", items: overdue }, { label: "Today", items: today }, { label: "Upcoming", items: upcoming }]
    : [{ label: "Completed", items: tasks }];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tasks"
        subtitle="Follow-ups, supplier confirmations and payment chases."
        actions={
          <button className="btn btn-primary hover:btn-primary-hover" onClick={() => openCreate("task")}>
            <Plus className="size-4" /> New task
          </button>
        }
      />

      <div className="flex flex-wrap gap-2">
        <div className="flex rounded-lg border border-line p-0.5">
          {(["mine", "all"] as const).map((s) => (
            <button key={s} onClick={() => setScope(s)} className={`rounded-md px-3 py-1.5 text-sm font-semibold capitalize ${scope === s ? "bg-surface shadow-sm" : "text-muted"}`}>{s === "mine" ? "My tasks" : "All tasks"}</button>
          ))}
        </div>
        <div className="flex rounded-lg border border-line p-0.5">
          {(["open", "done"] as const).map((s) => (
            <button key={s} onClick={() => setShow(s)} className={`rounded-md px-3 py-1.5 text-sm font-semibold capitalize ${show === s ? "bg-surface shadow-sm" : "text-muted"}`}>{s === "open" ? "Open" : "Completed"}</button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setDueTodayOnly((v) => !v)}
          className={`rounded-lg border border-line px-3 py-1.5 text-sm font-semibold ${dueTodayOnly ? "bg-surface shadow-sm" : "text-muted"}`}
        >
          Due today
        </button>
      </div>

      <div className="space-y-5">
        {groups.map((g) => (
          g.items.length === 0 ? null : (
            <div key={g.label}>
              <h2 className={`mb-2 text-xs font-bold uppercase tracking-wide ${g.label === "Overdue" ? "text-warning" : "text-muted"}`}>{g.label} · {g.items.length}</h2>
              <div className="card divide-y divide-line">
                {g.items.map((t) => {
                  const c = data.customers.find((x) => x.id === t.customerId);
                  const assignee = ws.user(t.assignedToId);
                  return (
                    <div
                      key={t.id}
                      id={`task-${t.id}`}
                      className={`flex items-start gap-3 p-3.5 ${t.id === highlightTaskId ? "bg-surface-2 ring-1 ring-inset ring-terracotta" : ""}`}
                    >
                      <button
                        type="button"
                        onClick={() => ws.toggleTask(t.id)}
                        className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border ${t.done ? "border-success bg-success text-white" : "border-muted"}`}
                        aria-label={t.done ? "Mark not done" : "Mark done"}
                      >
                        {t.done ? "✓" : ""}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium ${t.done ? "text-muted line-through" : ""}`}>{t.title}</p>
                        <p className="text-xs text-muted">
                          {TASK_TYPE_LABELS[t.type]}
                          {c ? <> · <Link href={`/customers/${c.id}`} className="hover:text-terracotta">{c.name}</Link></> : null}
                          {t.enquiryId ? <> · <Link href={`/enquiries/${t.enquiryId}`} className="hover:text-terracotta">enquiry</Link></> : null}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-xs ${isOverdue(t.dueAt) && !t.done ? "font-semibold text-warning" : "text-muted"}`}>{formatDate(t.dueAt)} {formatTime(t.dueAt)}</p>
                        <div className="mt-0.5 flex justify-end"><PriorityDot priority={t.priority} /></div>
                        <p className="text-[11px] text-muted">{assignee?.name.split(" ")[0]}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        ))}
        {tasks.length === 0 ? <p className="card p-8 text-center text-sm text-muted">No {show === "open" ? "open" : "completed"} tasks.</p> : null}
      </div>
    </div>
  );
}
