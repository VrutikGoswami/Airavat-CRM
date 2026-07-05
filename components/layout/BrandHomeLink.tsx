"use client";

import Image from "next/image";
import Link from "next/link";

export function BrandHomeLink({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/dashboard"
      onClick={onNavigate}
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
    </Link>
  );
}
