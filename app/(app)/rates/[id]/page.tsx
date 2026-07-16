import { RateDocumentReview } from "@/components/rates/RateDocumentReview";

export default async function SupplierRateDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RateDocumentReview documentId={id} />;
}
