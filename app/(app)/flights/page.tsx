"use client";

import { Suspense } from "react";
import { FlightFinder } from "@/components/flights/FlightFinder";
import { PageHeader } from "@/components/ui/misc";

export default function FlightsPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="Flight Finder" subtitle="Search fares, apply your margin, and create a client-ready draft." />
      <Suspense fallback={<div className="h-80 animate-pulse border-y border-line bg-surface" />}>
        <FlightFinder />
      </Suspense>
    </div>
  );
}
