// Pure layout math for the Timeline view. No React, no DOM — so it can be
// verified by scripts/verify-timeline-layout.ts without a browser.
//
// Convention throughout: years are integers that count DOWN. BC years are
// positive; AD years continue past zero as negatives (AD 30 is -30), so the
// same comparisons order the whole span from creation to the apostles.
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
export const MIN_WIDTH_PCT = 0.35;
export function spanToBox(span: Span, range: TimelineRange): { leftPct: number; widthPct: number; floored: boolean } {
  const leftPct = yearToPct(span.startBc, range);
  const rawWidth = yearToPct(span.endBc, range) - leftPct;
  const floored = rawWidth < MIN_WIDTH_PCT;
  return { leftPct, widthPct: Math.max(rawWidth, MIN_WIDTH_PCT), floored };
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

// ── BC/AD display ───────────────────────────────────────────────────────────
// Years continue counting DOWN past zero into the New Testament: an AD year is
// stored as its negative, so AD 30 is -30. That keeps every function above
// working unchanged — 931 (BC) is still numerically greater, and therefore
// earlier, than -30 (AD 30) — and confines the BC/AD distinction to display.
// There is no year zero: 1 is 1 BC and -1 is AD 1.

/** "931 BC" / "AD 30". */
export function formatYear(year: number): string {
  return year > 0 ? `${year} BC` : `AD ${-year}`;
}

/**
 * A span, collapsing the era suffix when both ends share one:
 * "931–913 BC", "AD 28–33", "5 BC – AD 30", or just "AD 30" for a single year.
 */
export function formatYearSpan(startYear: number, endYear: number): string {
  if (startYear === endYear) return formatYear(startYear);
  if (startYear > 0 && endYear > 0) return `${startYear}–${endYear} BC`;
  if (startYear <= 0 && endYear <= 0) return `AD ${-startYear}–${-endYear}`;
  return `${startYear} BC – AD ${-endYear}`;
}
