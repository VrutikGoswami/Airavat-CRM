import type { ReactNode } from "react";

/** Labelled field wrapper with error text, for use with react-hook-form. */
export function Field({
  label,
  error,
  children,
  hint,
  optional,
}: {
  label: string;
  error?: string;
  children: ReactNode;
  hint?: string;
  optional?: boolean;
}) {
  return (
    <div>
      <label className="field-label">
        {label}
        {optional ? <span className="ml-1 font-normal normal-case text-muted/70">(optional)</span> : null}
      </label>
      {children}
      {hint && !error ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      {error ? (
        <p className="mt-1 text-xs font-semibold text-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
