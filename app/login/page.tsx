"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Suspense, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { demoUsers } from "@/lib/staff";
import { Avatar } from "@/components/ui/Avatar";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const users = demoUsers();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const signIn = async (userId: string) => {
    setBusy(userId);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error("Sign-in failed");
      const next = params.get("next");
      router.replace(next && next.startsWith("/") ? next : "/dashboard");
      router.refresh();
    } catch {
      setError("Could not sign in. Please try again.");
      setBusy(null);
    }
  };

  return (
    <main className="flex min-h-svh items-center justify-center bg-forest px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-2 text-[#cdd8cf]">
          <Image
            src="/images/airavat-logo.jpg"
            alt=""
            width={28}
            height={28}
            className="size-7 rounded-md object-cover"
            priority
          />
          <span className="text-lg font-bold tracking-tight text-white">Airavat CRM</span>
        </div>

        <div className="card p-6 sm:p-8">
          <h1 className="text-xl font-bold">Sign in</h1>
          <p className="mt-1 text-sm text-muted">
            Choose a demo profile to explore the workspace. Production uses Supabase email
            authentication.
          </p>

          <div className="mt-6 space-y-2">
            {users.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => signIn(u.id)}
                disabled={busy !== null}
                className="row-hover flex w-full items-center gap-3 rounded-[10px] border border-line p-3 text-left disabled:opacity-60"
              >
                <Avatar initials={u.initials} seed={u.id} size={40} />
                <span className="flex-1">
                  <span className="block font-semibold">{u.name}</span>
                  <span className="block text-xs text-muted">
                    {u.role === "admin" ? "Founder / Administrator" : "Travel Consultant"} · {u.email}
                  </span>
                </span>
                {busy === u.id ? (
                  <span className="text-xs text-muted">Signing in…</span>
                ) : (
                  <span className="text-xs font-semibold text-terracotta">Sign in →</span>
                )}
              </button>
            ))}
          </div>

          {error ? <p className="mt-4 text-sm font-semibold text-error">{error}</p> : null}

          <p className="mt-6 flex items-center gap-2 text-xs text-muted">
            <ShieldCheck className="size-4" aria-hidden />
            Demo mode — sample data only, no real customer information.
          </p>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
