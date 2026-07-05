"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function BrandHomeLink({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const goDashboard = () => {
    if (loading) return;
    setLoading(true);
    onNavigate?.();
    timerRef.current = setTimeout(() => {
      router.push("/dashboard");
      setLoading(false);
    }, 3000);
  };

  return (
    <>
      <button
        type="button"
        onClick={goDashboard}
        className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left transition hover:bg-white/10"
        aria-label="Open Airavat CRM dashboard"
      >
        <Image
          src="/images/airavat-logo.jpg"
          alt=""
          width={32}
          height={32}
          className="size-8 rounded-md object-cover"
          priority
        />
        <span className="text-lg font-bold tracking-tight text-white">Airavat CRM</span>
      </button>

      {loading ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-forest/95 px-6 text-center text-white backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-col items-center">
            <Image
              src="/images/airavat-logo.jpg"
              alt="Airavat"
              width={88}
              height={88}
              className="size-20 rounded-2xl object-cover shadow-xl"
              priority
            />
            <div className="mt-6 size-9 animate-spin rounded-full border-2 border-white/25 border-t-terracotta" />
            <p className="mt-4 text-sm font-semibold tracking-wide">Opening dashboard...</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
