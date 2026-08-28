// Assertion suite for the pure timeline layout math. This project has no test
// framework; this script is the test suite. Run: npx tsx scripts/verify-timeline-layout.ts
import {
  yearToPct, spanToBox, spansOverlap, packRows, computeRange,
  type TimelineRange, type Span,
} from "../lib/timeline-layout";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (ok) console.log(`  PASS  ${label}`);
  else { console.log(`  FAIL  ${label}${detail ? " — " + detail : ""}`); failures++; }
}
function near(a: number, b: number, tol = 0.001) { return Math.abs(a - b) < tol; }

const RANGE: TimelineRange = { startBc: 1000, endBc: 500 }; // 500-year span

console.log("Timeline layout verification\n");

// yearToPct: BC counts down, so the range start is the LEFT edge (0%).
check("yearToPct maps range start to 0%", near(yearToPct(1000, RANGE), 0));
check("yearToPct maps range end to 100%", near(yearToPct(500, RANGE), 100));
check("yearToPct maps midpoint to 50%", near(yearToPct(750, RANGE), 50));
check("yearToPct is monotonic left-to-right", yearToPct(900, RANGE) < yearToPct(600, RANGE));

// spanToBox
const box = spanToBox({ id: "a", startBc: 900, endBc: 800 }, RANGE);
check("spanToBox left edge uses startBc", near(box.leftPct, 20));
check("spanToBox width covers the span", near(box.widthPct, 20));
const zero = spanToBox({ id: "z", startBc: 700, endBc: 700 }, RANGE);
check("zero-length span still gets a visible minimum width", zero.widthPct > 0);

// spansOverlap — BC semantics: [startBc..endBc] with startBc >= endBc
check("overlapping spans detected",
  spansOverlap({ id: "a", startBc: 900, endBc: 800 }, { id: "b", startBc: 850, endBc: 750 }));
check("disjoint spans not flagged",
  !spansOverlap({ id: "a", startBc: 900, endBc: 800 }, { id: "b", startBc: 790, endBc: 700 }));
check("spans sharing only a boundary year do NOT overlap (accession-year convention)",
  !spansOverlap({ id: "a", startBc: 931, endBc: 913 }, { id: "b", startBc: 913, endBc: 911 }));
check("a span fully inside another overlaps",
  spansOverlap({ id: "a", startBc: 900, endBc: 700 }, { id: "b", startBc: 850, endBc: 800 }));

// packRows
const sequential: Span[] = [
  { id: "1", startBc: 931, endBc: 913 },
  { id: "2", startBc: 913, endBc: 911 },
  { id: "3", startBc: 911, endBc: 870 },
];
check("non-overlapping spans pack into a single row", packRows(sequential).length === 1);

const overlapping: Span[] = [
  { id: "a", startBc: 1350, endBc: 1310 },
  { id: "b", startBc: 1340, endBc: 1300 }, // overlaps a
  { id: "c", startBc: 1290, endBc: 1200 }, // clear of both
];
const packed = packRows(overlapping);
check("overlapping spans get separate rows", packed.length === 2);
check("a later non-overlapping span reuses the first row",
  packed[0].some(s => s.id === "c"), "expected c back on row 0");
check("every input span appears exactly once",
  packed.flat().length === 3 && new Set(packed.flat().map(s => s.id)).size === 3);
check("empty input yields no rows", packRows([]).length === 0);

// computeRange
const r = computeRange(
  [{ id: "p", startBc: 900, endBc: 800 }, { id: "q", startBc: 700, endBc: 600 }],
  [750],
  10,
);
check("computeRange starts at the earliest year plus padding", r.startBc === 910);
check("computeRange ends at the latest year minus padding", r.endBc === 590);
check("computeRange includes bare point years",
  computeRange([], [800, 600], 0).startBc === 800);

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
process.exit(failures === 0 ? 0 : 1);
