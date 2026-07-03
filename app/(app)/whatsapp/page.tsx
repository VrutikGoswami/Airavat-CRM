"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, CheckCheck, Clock, Send, Sparkles, UserPlus } from "lucide-react";
import { useWorkspace } from "@/lib/workspace";
import { Avatar } from "@/components/ui/Avatar";
import { StageBadge } from "@/components/ui/chips";
import { useCreateModals } from "@/components/forms/CreateModals";
import { quickReplies } from "@/lib/quick-replies";
import { formatTime, relativeTime, daysUntil, formatDateRange } from "@/lib/format";
import type { Message } from "@/lib/types";

export default function WhatsAppPage() {
  const ws = useWorkspace();
  const { data } = ws;
  const { openCreate } = useCreateModals();

  const conversations = useMemo(
    () => [...data.conversations].sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt)),
    [data.conversations],
  );
  const [activeId, setActiveId] = useState(conversations[0]?.id ?? "");
  const [mobilePane, setMobilePane] = useState<"list" | "thread">("list");
  const [draft, setDraft] = useState("");
  const [newName, setNewName] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);

  const active = conversations.find((c) => c.id === activeId);
  const messages = active ? ws.messagesFor(active.id) : [];
  const customer = ws.customer(active?.customerId);
  const enquiry = ws.enquiry(active?.enquiryId);

  useEffect(() => {
    if (active && active.unreadCount > 0) ws.markConversationRead(active.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [messages.length, activeId]);

  const openConversation = (id: string) => {
    setActiveId(id);
    setMobilePane("thread");
  };

  const send = () => {
    if (!active || !draft.trim()) return;
    ws.sendMessage(active.id, draft.trim());
    setDraft("");
  };

  const windowOpen = active ? daysUntil(active.windowExpiresAt) >= 0 : false;

  return (
    <div className="flex h-[calc(100svh-6.5rem)] flex-col">
      <h1 className="mb-3 text-xl font-bold sm:text-2xl">WhatsApp inbox</h1>
      <div className="grid min-h-0 flex-1 overflow-hidden rounded-[12px] border border-line bg-surface lg:grid-cols-[300px_1fr_300px]">
        {/* Left: conversation list */}
        <div className={`min-h-0 flex-col border-r border-line ${mobilePane === "list" ? "flex" : "hidden"} lg:flex`}>
          <div className="border-b border-line px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-muted">
            Conversations
          </div>
          <ul className="scroll-thin min-h-0 flex-1 divide-y divide-line overflow-y-auto">
            {conversations.map((c) => {
              const last = ws.messagesFor(c.id).slice(-1)[0];
              const assignee = ws.user(c.assignedConsultantId);
              const enq = ws.enquiry(c.enquiryId);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => openConversation(c.id)}
                    data-active={c.id === activeId}
                    className={`w-full px-3 py-3 text-left ${c.id === activeId ? "bg-surface-2" : "row-hover"}`}
                  >
                    <div className="flex items-center gap-2">
                      <Avatar initials={(c.displayName.match(/[A-Za-z]/) ? c.displayName.split(" ").map((p) => p[0]).slice(0, 2).join("") : "#")} seed={c.id} size={30} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold">{c.displayName}</span>
                          <span className="shrink-0 text-[11px] text-muted">{last ? relativeTime(last.at) : ""}</span>
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5">
                          <span className="truncate text-xs text-muted">{last?.body ?? "No messages"}</span>
                        </span>
                      </span>
                      {c.unreadCount > 0 ? (
                        <span className="tnum shrink-0 rounded-full bg-terracotta px-1.5 py-0.5 text-[10px] font-bold text-white">{c.unreadCount}</span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex items-center gap-2 pl-9">
                      {assignee ? <span className="text-[11px] text-muted">{assignee.name.split(" ")[0]}</span> : <span className="text-[11px] text-warning">Unassigned</span>}
                      {enq ? <span className="text-[11px] text-muted">· {enq.stage.replace(/-/g, " ")}</span> : null}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Centre: thread */}
        <div className={`min-h-0 flex-col ${mobilePane === "thread" ? "flex" : "hidden"} lg:flex`}>
          {active ? (
            <>
              <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
                <button className="lg:hidden" onClick={() => setMobilePane("list")} aria-label="Back to list"><ArrowLeft className="size-5" /></button>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{active.displayName}</p>
                  <p className="tnum text-xs text-muted">{active.phone}</p>
                </div>
                <select
                  className="field max-w-[150px] py-1 text-xs"
                  value={active.assignedConsultantId ?? ""}
                  onChange={(e) => ws.assignConversation(active.id, e.target.value)}
                  aria-label="Assign conversation"
                >
                  <option value="">Unassigned</option>
                  {data.users.map((u) => <option key={u.id} value={u.id}>{u.name.split(" ")[0]}</option>)}
                </select>
              </div>

              <div ref={threadRef} className="scroll-thin min-h-0 flex-1 space-y-2 overflow-y-auto bg-surface-2/40 px-4 py-4">
                {messages.map((m) => <Bubble key={m.id} message={m} />)}
              </div>

              {/* Composer */}
              <div className="border-t border-line px-3 py-2.5">
                {!windowOpen ? (
                  <p className="mb-2 rounded-md bg-warning/10 px-2 py-1 text-[11px] text-warning">
                    The 24-hour customer window has closed. Only approved template messages can be sent until the customer replies.
                  </p>
                ) : null}
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {quickReplies.map((q) => (
                    <button key={q.label} type="button" onClick={() => setDraft(q.body)} className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted row-hover">
                      {q.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setDraft("Suggested reply (please review before sending): Thank you for your message — a consultant will confirm the details and get back to you shortly.")}
                    className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[11px] text-info row-hover"
                    title="AI draft — requires staff review before sending"
                  >
                    <Sparkles className="size-3" /> AI draft
                  </button>
                </div>
                <div className="flex items-end gap-2">
                  <textarea
                    className="field max-h-32 flex-1 resize-none"
                    rows={1}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                    placeholder="Type a message… (staff approval required for prices & booking details)"
                  />
                  <button type="button" onClick={send} className="btn btn-primary hover:btn-primary-hover" aria-label="Send"><Send className="size-4" /></button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted">Select a conversation</div>
          )}
        </div>

        {/* Right: context */}
        <div className="hidden min-h-0 flex-col overflow-y-auto border-l border-line lg:flex">
          <div className="border-b border-line px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-muted">Customer context</div>
          <div className="space-y-4 p-4">
            {active ? (
              customer ? (
                <>
                  <div>
                    <div className="flex items-center gap-2">
                      <Avatar initials={customer.name.split(" ").map((p) => p[0]).slice(0, 2).join("")} seed={customer.id} size={34} />
                      <div>
                        <Link href={`/customers/${customer.id}`} className="text-sm font-semibold hover:text-terracotta">{customer.name}</Link>
                        <p className="tnum text-xs text-muted">{customer.whatsapp}</p>
                      </div>
                    </div>
                  </div>
                  {enquiry ? (
                    <div className="rounded-lg border border-line p-3">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted">Active enquiry</span>
                        <StageBadge stage={enquiry.stage} />
                      </div>
                      <p className="text-sm font-medium">{enquiry.destination}</p>
                      <p className="text-xs text-muted">{formatDateRange(enquiry.travelStartDate, enquiry.travelEndDate)}</p>
                      <p className="mt-1 text-xs text-muted">Next: {enquiry.nextActionLabel}</p>
                      <Link href={`/enquiries/${enquiry.id}`} className="mt-2 inline-block text-xs font-semibold text-terracotta">Open enquiry →</Link>
                    </div>
                  ) : (
                    <button className="btn btn-ghost w-full" onClick={() => openCreate("enquiry", customer.id)}>Create enquiry</button>
                  )}
                </>
              ) : (
                <div className="rounded-lg border border-dashed border-line p-3">
                  <p className="text-sm font-semibold">New number</p>
                  <p className="mt-1 text-xs text-muted">No customer record yet for {active.phone}. Create one to start tracking this lead.</p>
                  <input className="field mt-3" placeholder="Customer name" value={newName} onChange={(e) => setNewName(e.target.value)} />
                  <button
                    className="btn btn-primary hover:btn-primary-hover mt-2 w-full"
                    onClick={() => { if (newName.trim()) { const id = ws.createCustomerFromConversation(active.id, newName.trim()); setNewName(""); openCreate("enquiry", id); } }}
                  >
                    <UserPlus className="size-4" /> Create customer &amp; enquiry
                  </button>
                </div>
              )
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function Bubble({ message }: { message: Message }) {
  const out = message.direction === "out";
  return (
    <div className={`flex ${out ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${out ? "rounded-br-sm bg-[#dcf2e4] text-ink" : "rounded-bl-sm bg-surface text-ink"} border border-line`}>
        <p className="whitespace-pre-wrap">{message.body}</p>
        <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted">
          {message.isTemplate ? <span className="mr-1">Template</span> : null}
          {formatTime(message.at)}
          {out ? <DeliveryTick status={message.status} /> : null}
        </p>
      </div>
    </div>
  );
}

function DeliveryTick({ status }: { status: Message["status"] }) {
  if (status === "read") return <CheckCheck className="size-3 text-info" aria-label="Read" />;
  if (status === "delivered") return <CheckCheck className="size-3" aria-label="Delivered" />;
  if (status === "sent") return <Check className="size-3" aria-label="Sent" />;
  if (status === "failed") return <span className="text-error">failed</span>;
  return <Clock className="size-3" aria-label="Pending" />;
}
