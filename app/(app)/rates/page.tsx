import { PageHeader } from "@/components/ui/misc";
import { RateDocumentsClient } from "@/components/rates/RateDocumentsClient";

export default function SupplierRatesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Supplier Rates"
        subtitle="Upload supplier PDFs, review extracted rows and publish approved hotel rates."
      />
      <RateDocumentsClient />
    </div>
  );
}
