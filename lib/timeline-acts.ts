import { TIMELINE_PERIODS } from "./timeline-periods";

// A viewport preset, not a new dataset: each act just narrows the year range
// (and, downstream, the default zoom) so the whole Genesis-to-2026 span —
// 4,192 years and 19 chapters — doesn't have to be read or scrolled at once.
// "Everything" is the continuous creation-to-today view; the other three are
// scoped reading modes.
export type TimelineActId = "old-testament" | "new-testament" | "after-nt" | "everything";

export interface TimelineAct {
  id: TimelineActId;
  label: string;
  startBc: number | null; // null = no lower bound ("Everything")
  endBc: number | null;   // null = no upper bound ("Everything")
  zoom: number;           // suggested default horizontal zoom for this span
}

// Boundaries are derived from the period table itself, by first/last period
// id, rather than hardcoded — so an act can never drift out of sync with the
// chapters it's supposed to bound, and adding a period later just works.
function periodBounds(firstId: string, lastId: string): { startBc: number; endBc: number } {
  const first = TIMELINE_PERIODS.find(p => p.id === firstId);
  const last = TIMELINE_PERIODS.find(p => p.id === lastId);
  if (!first || !last) throw new Error(`timeline-acts: unknown period id ("${firstId}" or "${lastId}")`);
  return { startBc: first.startBc, endBc: last.endBc };
}

const OT = periodBounds("judges", "between");
const NT = periodBounds("nativity", "apostolic-end");
const AFTER_NT = periodBounds("persecuted-church", "global-church");

export const TIMELINE_ACTS: TimelineAct[] = [
  { id: "old-testament", label: "Old Testament", startBc: OT.startBc, endBc: OT.endBc, zoom: 1.5 },
  { id: "new-testament", label: "New Testament", startBc: NT.startBc, endBc: NT.endBc, zoom: 3 },
  { id: "after-nt", label: "After New Testament", startBc: AFTER_NT.startBc, endBc: AFTER_NT.endBc, zoom: 10 },
  { id: "everything", label: "Everything", startBc: null, endBc: null, zoom: 1.5 },
];

export function getAct(id: TimelineActId): TimelineAct {
  return TIMELINE_ACTS.find(a => a.id === id) ?? TIMELINE_ACTS[TIMELINE_ACTS.length - 1];
}

/** Does this year fall inside the act's range? Always true for "Everything". */
export function yearInAct(yearBc: number, act: TimelineAct): boolean {
  if (act.startBc === null || act.endBc === null) return true;
  return yearBc <= act.startBc && yearBc >= act.endBc;
}
