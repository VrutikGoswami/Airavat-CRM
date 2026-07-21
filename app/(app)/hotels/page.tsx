"use client";

import { Suspense } from "react";
import { HotelFinder } from "@/components/hotels/HotelFinder";
import { PageHeader } from "@/components/ui/misc";

export default function HotelsPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="Hotel Finder" subtitle="Match approved supplier rates and build a client-ready hotel quotation." />
      <Suspense fallback={<div className="h-80 animate-pulse border-y border-line bg-surface" />}>
        <HotelFinder />
      </Suspense>
    </div>
  );
}
