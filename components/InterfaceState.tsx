import type { ReactNode } from "react";

type StateKind = "people" | "books" | "tree" | "timeline" | "traditions";

function StateMark({ kind }: { kind: StateKind }) {
  if (kind === "people") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="12" cy="10" r="4" />
        <path d="M4.5 25c.7-5 3.2-7.5 7.5-7.5s6.8 2.5 7.5 7.5" />
        <circle cx="23" cy="12" r="3" />
        <path d="M20.5 19c4.4-.6 7 1.4 7.5 5" />
      </svg>
    );
  }

  if (kind === "books") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M4 6.5h7.5c2.5 0 4.5 2 4.5 4.5v15c0-2.2-1.8-4-4-4H4z" />
        <path d="M28 6.5h-7.5c-2.5 0-4.5 2-4.5 4.5v15c0-2.2 1.8-4 4-4h8z" />
      </svg>
    );
  }

  if (kind === "timeline") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M6 9h20M6 16h20M6 23h20" />
        <circle cx="10" cy="9" r="2.5" />
        <circle cx="21" cy="16" r="2.5" />
        <circle cx="14" cy="23" r="2.5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 27V12M16 16l-7-6M16 19l7-6M9 10V6M23 13V8" />
      <circle cx="9" cy="5" r="2.5" />
      <circle cx="23" cy="7" r="2.5" />
      <circle cx="16" cy="27" r="2.5" />
    </svg>
  );
}

interface InterfaceStateProps {
  kind: StateKind;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}

export function InterfaceState({ kind, title, description, action, compact = false }: InterfaceStateProps) {
  return (
    <div className={`interface-state${compact ? " interface-state-compact" : ""}`}>
      <div className="interface-state-mark"><StateMark kind={kind} /></div>
      <div className="interface-state-copy">
        <div className="interface-state-title">{title}</div>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="interface-state-action">{action}</div> : null}
    </div>
  );
}

export function LoadingState({ label = "Opening the archive…" }: { label?: string }) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <div className="loading-state-book" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <span>{label}</span>
    </div>
  );
}
