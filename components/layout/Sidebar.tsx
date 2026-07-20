"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  CalendarCheck,
  KanbanSquare,
  LayoutDashboard,
  ListTodo,
  MessageSquare,
  Plus,
  Plane,
  Settings,
  Users,
  FileText,
  BadgeDollarSign,
} from "lucide-react";
import { useWorkspace } from "@/lib/workspace";
import { useCreateModals } from "@/components/forms/CreateModals";
import { BrandHomeLink } from "@/components/layout/BrandHomeLink";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/quotations", label: "Quotations", icon: FileText },
  { href: "/flights", label: "Flight Finder", icon: Plane },
  { href: "/rates", label: "Supplier Rates", icon: BadgeDollarSign },
  { href: "/bookings", label: "Bookings", icon: CalendarCheck },
  { href: "/whatsapp", label: "WhatsApp", icon: MessageSquare },
  { href: "/tasks", label: "Tasks", icon: ListTodo },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data } = useWorkspace();
  const { openCreate } = useCreateModals();
  const [menuOpen, setMenuOpen] = useState(false);

  const whatsappUnread = data.conversations.reduce((n, c) => n + c.unreadCount, 0);
  const openTasks = data.tasks.filter((t) => !t.done).length;

  return (
    <div className="flex h-full flex-col bg-forest text-[#cdd8cf]">
      <div className="px-4 py-4">
        <BrandHomeLink onNavigate={onNavigate} />
      </div>

      <div className="relative px-3">
        <button
          type="button"
          className="btn btn-primary hover:btn-primary-hover w-full"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          <Plus className="size-4" aria-hidden /> Create
        </button>
        {menuOpen ? (
          <div
            className="absolute left-3 right-3 z-40 mt-1 overflow-hidden rounded-[10px] border border-line bg-surface py-1 text-ink"
            style={{ boxShadow: "var(--shadow-pop)" }}
            role="menu"
          >
            {[
              { label: "New enquiry", kind: "enquiry" as const },
              { label: "New customer", kind: "customer" as const },
              { label: "New quotation", kind: "quotation" as const },
              { label: "New task", kind: "task" as const },
            ].map((item) => (
              <button
                key={item.kind}
                type="button"
                role="menuitem"
                className="row-hover block w-full px-3 py-2 text-left text-sm"
                onClick={() => {
                  setMenuOpen(false);
                  openCreate(item.kind);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <nav aria-label="Primary" className="scroll-thin mt-4 flex-1 space-y-0.5 overflow-y-auto px-3">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const badge =
            item.href === "/whatsapp" && whatsappUnread > 0
              ? whatsappUnread
              : item.href === "/tasks" && openTasks > 0
                ? openTasks
                : null;
          return (
            <Link
              key={item.href}
              href={item.href}
              data-active={active}
              className="nav-item"
              onClick={onNavigate}
            >
              <item.icon className="size-4.5 shrink-0" aria-hidden />
              <span className="flex-1">{item.label}</span>
              {badge ? (
                <span className="tnum rounded-full bg-terracotta px-1.5 py-0.5 text-[11px] font-bold text-white">
                  {badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <p className="px-4 py-3 text-[11px] text-[#8fa392]">Airavat staff workspace</p>
    </div>
  );
}
