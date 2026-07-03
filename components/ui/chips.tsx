import { Badge } from "@/components/ui/Badge";
import {
  BOOKING_STATUS_LABELS,
  BOOKING_STATUS_TONE,
  QUOTATION_STATUS_LABELS,
  QUOTATION_STATUS_TONE,
  STAGE_TONE,
  WAITING_ON_LABELS,
  stageLabel,
} from "@/lib/labels";
import type { BookingStatus, PipelineStage, Priority, QuotationStatus, WaitingOn } from "@/lib/types";

export function StageBadge({ stage }: { stage: PipelineStage }) {
  return <Badge tone={STAGE_TONE[stage]}>{stageLabel(stage)}</Badge>;
}

export function QuotationStatusBadge({ status }: { status: QuotationStatus }) {
  return <Badge tone={QUOTATION_STATUS_TONE[status]}>{QUOTATION_STATUS_LABELS[status]}</Badge>;
}

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return <Badge tone={BOOKING_STATUS_TONE[status]}>{BOOKING_STATUS_LABELS[status]}</Badge>;
}

export function WaitingOnPill({ waitingOn }: { waitingOn: WaitingOn }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted">
      <span
        aria-hidden
        className={`inline-block size-1.5 rounded-full ${
          waitingOn === "customer" ? "bg-warning" : waitingOn === "team" ? "bg-info" : waitingOn === "supplier" ? "bg-muted" : "bg-success"
        }`}
      />
      Waiting: {WAITING_ON_LABELS[waitingOn]}
    </span>
  );
}

const PRIORITY_TONE: Record<Priority, string> = { low: "bg-muted", medium: "bg-warning", high: "bg-error" };

export function PriorityDot({ priority }: { priority: Priority }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs capitalize text-muted">
      <span aria-hidden className={`inline-block size-1.5 rounded-full ${PRIORITY_TONE[priority]}`} />
      {priority}
    </span>
  );
}
