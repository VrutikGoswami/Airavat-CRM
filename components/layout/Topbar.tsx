"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, Menu, RefreshCw, UserCog } from "lucide-react";
import { useWorkspace } from "@/lib/workspace";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { Avatar } from "@/components/ui/Avatar";

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const router = useRouter();
  const { currentUser, data, setCurrentUserId, resetDemo } = useWorkspace();
  const [menuOpen, setMenuOpen] = useState(false);

  const switchUser = async (userId: string) => {
    setMenuOpen(false);
    await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    setCurrentUserId(userId);
    router.refresh();
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-ivory/95 px-3 backdrop-blur sm:px-5">
      <button
        type="button"
        onClick={onOpenMenu}
        className="row-hover rounded-md p-2 lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </button>

      <div className="flex-1">
        <GlobalSearch />
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="row-hover flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-2.5"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <Avatar initials={currentUser.initials} seed={currentUser.id} size={28} />
          <span className="hidden text-left sm:block">
            <span className="block text-xs font-semibold leading-tight">{currentUser.name}</span>
            <span className="block text-[11px] leading-tight text-muted">
              {currentUser.role === "admin" ? "Administrator" : "Consultant"}
            </span>
          </span>
        </button>

        {menuOpen ? (
          <div
            className="absolute right-0 z-40 mt-1 w-60 overflow-hidden rounded-[10px] border border-line bg-surface py-1"
            style={{ boxShadow: "var(--shadow-pop)" }}
            role="menu"
          >
            <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Switch demo profile
            </p>
            {data.users.map((u) => (
              <button
                key={u.id}
                type="button"
                role="menuitem"
                onClick={() => switchUser(u.id)}
                className="row-hover flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
              >
                <UserCog className="size-4 text-muted" aria-hidden />
                <span className="flex-1">{u.name}</span>
                {u.id === currentUser.id ? <span className="text-[11px] text-terracotta">Active</span> : null}
              </button>
            ))}
            <div className="my-1 border-t border-line" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                resetDemo();
              }}
              className="row-hover flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
            >
              <RefreshCw className="size-4 text-muted" aria-hidden /> Reset demo data
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={logout}
              className="row-hover flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-error"
            >
              <LogOut className="size-4" aria-hidden /> Sign out
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
