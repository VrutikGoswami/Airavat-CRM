import type { ReactNode } from "react";

export type Tone = "neutral" | "info" | "success" | "warning" | "error";

export function Badge({ tone = "neutral", children }: { tone?: Tone | string; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
