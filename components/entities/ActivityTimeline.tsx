import {
  Banknote,
  CheckCircle2,
  FileText,
  Globe,
  MessageSquare,
  Phone,
  Send,
  StickyNote,
  ThumbsUp,
  Workflow,
} from "lucide-react";
import type { Activity, ActivityKind } from "@/lib/types";
import { relativeTime } from "@/lib/format";

const ICONS: Record<ActivityKind, typeof Globe> = {
  "website-form": Globe,
  whatsapp: MessageSquare,
  call: Phone,
  note: StickyNote,
  "quotation-created": FileText,
  "quotation-sent": Send,
  "quotation-response": ThumbsUp,
  payment: Banknote,
  "booking-confirmed": CheckCircle2,
  "stage-change": Workflow,
  task: CheckCircle2,
};

export function ActivityTimeline({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) {
    return <p className="text-sm text-muted">No activity recorded yet.</p>;
  }
  return (
    <ol className="space-y-0">
      {activities.map((a, i) => {
        const Icon = ICONS[a.kind] ?? StickyNote;
        return (
          <li key={a.id} className="relative flex gap-3 pb-4 last:pb-0">
            {i < activities.length - 1 ? (
              <span aria-hidden className="absolute left-[13px] top-7 h-[calc(100%-1rem)] w-px bg-line" />
            ) : null}
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-line bg-surface">
              <Icon className="size-3.5 text-muted" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm">{a.summary}</p>
              <p className="text-xs text-muted">{relativeTime(a.at)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
