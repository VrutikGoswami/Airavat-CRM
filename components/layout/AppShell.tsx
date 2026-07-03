"use client";

import { useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { CreateModalsProvider } from "@/components/forms/CreateModals";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

export function AppShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <CreateModalsProvider>
      <div className="flex min-h-svh">
        {/* Desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 hidden w-60 lg:block">
          <Sidebar />
        </aside>

        {/* Mobile drawer */}
        {drawerOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              aria-label="Close menu"
              className="absolute inset-0 bg-ink/40"
              onClick={() => setDrawerOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 w-64">
              <Sidebar onNavigate={() => setDrawerOpen(false)} />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="absolute right-2 top-3 rounded-md p-1.5 text-white/80"
                aria-label="Close menu"
              >
                <X className="size-5" />
              </button>
            </div>
          </div>
        ) : null}

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col lg:ml-60">
          <Topbar onOpenMenu={() => setDrawerOpen(true)} />
          <main className="min-w-0 flex-1 px-3 py-5 sm:px-5 lg:px-7 lg:py-7">{children}</main>
        </div>
      </div>
    </CreateModalsProvider>
  );
}
