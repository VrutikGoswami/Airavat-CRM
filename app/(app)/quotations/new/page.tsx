"use client";

import { Suspense } from "react";
import { PageHeader } from "@/components/ui/misc";
import { QuotationBuilder } from "@/components/quotation/QuotationBuilder";

export default function NewQuotationPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="New quotation" subtitle="Build a step-by-step travel quotation." />
      <Suspense fallback={<div className="card h-64 animate-pulse" />}>
        <QuotationBuilder />
      </Suspense>
    </div>
  );
}
