// Pure layout math for the Timeline view. No React, no DOM — so it can be
// verified by scripts/verify-timeline-layout.ts without a browser.
//
// Convention throughout: BC years are positive integers that count DOWN.
// 931 is EARLIER than 586. Every span satisfies startBc >= endBc, and the
// timeline runs left (earliest / largest number) to right (latest / smallest).

export interface TimelineRange {
  startBc: number; // left edge — the largest (earliest) year
  endBc: number;   // right edge — the smallest (latest) year
}

export interface Span {
  id: string;
  startBc: number;
  endBc: number;
}

/** Horizontal position of a year, as a percentage across the range. */
export function yearToPct(year: number, range: TimelineRange): number {
  const total = range.startBc - range.endBc;
  if (total <= 0) return 0;
  return ((range.startBc - year) / total) * 100;
}

/**
 * Left offset and width of a span, in percent. A zero-length span (a king who
 * reigned months, e.g. Zimri's seven days) would otherwise be invisible, so
 * width is floored at MIN_WIDTH_PCT.
 */
const MIN_WIDTH_PCT = 0.35;
export function spanToBox(span: Span, range: TimelineRange): { leftPct: number; widthPct: number } {
  const leftPct = yearToPct(span.startBc, range);
  const rawWidth = yearToPct(span.endBc, range) - leftPct;
  return { leftPct, widthPct: Math.max(rawWidth, MIN_WIDTH_PCT) };
}

/**
 * Do two spans share any time? Spans that merely touch at a boundary year do
 * NOT overlap — Judah's kings are recorded by accession year, so Rehoboam
 * (931-913) and Abijah (913-911) share 913 without co-reigning, and flagging
 * that would push all 20 kings onto separate rows.
 */
export function spansOverlap(a: Span, b: Span): boolean {
  return a.startBc > b.endBc && b.startBc > a.endBc;
}

/**
 * Greedy row packing: place each span in the first row where it collides with
 * nothing already there. Used by every lane whose members legitimately overlap
 * — the judges (several judged concurrently in different regions), the
 * prophets, and the books. Single-occupancy lanes like Judah's kings pack into
 * one row naturally and need no special case.
 */
export function packRows<T extends Span>(items: T[]): T[][] {
  const sorted = [...items].sort((x, y) => y.startBc - x.startBc); // earliest first
  const rows: T[][] = [];
  for (const item of sorted) {
    let placed = false;
    for (const row of rows) {
      if (!row.some(existing => spansOverlap(existing, item))) {
        row.push(item);
        placed = true;
        break;
      }
    }
    if (!placed) rows.push([item]);
  }
  return rows;
}

/**
 * The visible range, derived from the data rather than hardcoded, so adding
 * people or events later widens the view automatically.
 */
export function computeRange(spans: Span[], pointYears: number[], padYears = 20): TimelineRange {
  const years: number[] = [];
  for (const s of spans) years.push(s.startBc, s.endBc);
  for (const y of pointYears) years.push(y);
  if (years.length === 0) return { startBc: 1000, endBc: 500 };
  return {
    startBc: Math.max(...years) + padYears,
    endBc: Math.min(...years) - padYears,
  };
}
