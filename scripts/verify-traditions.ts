// Verification suite for the traditions dataset. This project has no test
// framework; these assertions are the test suite, in the spirit of
// verify-timeline.ts. Run: npx tsx scripts/verify-traditions.ts
import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN ?? process.env.TURSO_DATABASE_TURSO_AUTH_TOKEN,
});

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (ok) { console.log(`  PASS  ${label}`); }
  else { console.log(`  FAIL  ${label}${detail ? " — " + detail : ""}`); failures++; }
}

interface TraditionRow { id: string; name: string; kind: string; tier: number; start_year: number; end_year: number | null; distinctives: string; date_confidence: string; date_uncertainty_note: string }
interface EdgeRow { id: string; parent_id: string; child_id: string; type: string; year: number; event_id: string | null }

async function main() {
  console.log("Traditions data verification\n");

  const tCols = await db.execute("PRAGMA table_info(traditions)");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  check("traditions table exists", tCols.rows.length > 0);
  const eCols = await db.execute("PRAGMA table_info(tradition_edges)");
  check("tradition_edges table exists", eCols.rows.length > 0);
  const pCols = await db.execute("PRAGMA table_info(tradition_people)");
  check("tradition_people table exists", pCols.rows.length > 0);

  const traditions = (await db.execute("SELECT * FROM traditions")).rows as unknown as TraditionRow[];
  const edges = (await db.execute("SELECT * FROM tradition_edges")).rows as unknown as EdgeRow[];
  check("traditions present", traditions.length > 0, `got ${traditions.length}`);
  check("tradition edges present", edges.length > 0, `got ${edges.length}`);

  const byId = new Map(traditions.map(t => [t.id, t]));

  // ── Structural integrity ──────────────────────────────────────────────
  const danglingParent = edges.filter(e => !byId.has(e.parent_id));
  check("every edge's parent exists", danglingParent.length === 0,
    danglingParent.map(e => e.id).join(", "));
  const danglingChild = edges.filter(e => !byId.has(e.child_id));
  check("every edge's child exists", danglingChild.length === 0,
    danglingChild.map(e => e.id).join(", "));

  const validKinds = new Set(["communion", "tradition", "denomination", "movement", "cult"]);
  const badKind = traditions.filter(t => !validKinds.has(t.kind));
  check("every tradition has a recognized kind", badKind.length === 0,
    badKind.map(t => `${t.name}=${t.kind}`).join(", "));

  const badTier = traditions.filter(t => ![1, 2, 3].includes(t.tier));
  check("every tradition has tier 1, 2 or 3", badTier.length === 0,
    badTier.map(t => `${t.name}=${t.tier}`).join(", "));

  const validEdgeTypes = new Set(["split_from", "merged_into", "influenced_by", "renewal_within"]);
  const badEdgeType = edges.filter(e => !validEdgeTypes.has(e.type));
  check("every edge has a recognized type", badEdgeType.length === 0,
    badEdgeType.map(e => `${e.id}=${e.type}`).join(", "));

  // No tradition descends from itself. Reformed genuinely has TWO structural
  // parents (Western Church via split_from, Waldensian via merged_into) --
  // a legitimate convergence, not a cycle -- so a shared "visited anywhere"
  // set is the wrong tool here: it flags the second path reaching an
  // already-visited ancestor as a false "cycle" the moment two branches
  // converge, which is exactly what merged_into is FOR. A real cycle is a
  // node reachable from itself along the CURRENT path specifically, so this
  // needs the standard three-colour DFS (white/gray/black), not a flat
  // visited set -- gray means "an ancestor of the node currently being
  // explored", and only gray triggers a cycle; black ("fully explored,
  // popped back off") does not, exactly so shared ancestors like Western
  // Church can be validly reached twice.
  const structuralParentsOf = new Map<string, string[]>();
  for (const e of edges) {
    if (e.type !== "split_from" && e.type !== "merged_into") continue;
    (structuralParentsOf.get(e.child_id) ?? structuralParentsOf.set(e.child_id, []).get(e.child_id)!).push(e.parent_id);
  }
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  let cycleFound: string | null = null;
  function visit(id: string): boolean {
    color.set(id, GRAY);
    for (const parentId of structuralParentsOf.get(id) ?? []) {
      const c = color.get(parentId) ?? WHITE;
      if (c === GRAY) return true;           // back-edge to an ancestor on THIS path = real cycle
      if (c === WHITE && visit(parentId)) return true;
      // BLACK: already fully explored via a different branch -- a valid
      // convergence (e.g. Reformed reaching Western Church twice), not a cycle.
    }
    color.set(id, BLACK);
    return false;
  }
  for (const t of traditions) {
    if ((color.get(t.id) ?? WHITE) !== WHITE) continue;
    if (visit(t.id)) { cycleFound = t.name; break; }
  }
  check("no tradition descends from itself (no cycles)", cycleFound === null, cycleFound ?? "");

  // The EDGE's own year (not the child's start_year, which can legitimately
  // predate the edge -- Armenian Apostolic's own start_year is 301, three
  // national-church centuries before Oriental Orthodoxy existed as a
  // category at all in 451; the edge correctly carries 451, not 401) must
  // not fall before the parent existed at all.
  //
  // Deliberately NOT also checking edge.year against the parent's end_year:
  // the Reformation is seeded as a staggered split (Western Church ends
  // 1517, but its children's own edges run 1525-1536 -- see the findings
  // doc's "per-child edge years, not one uniform 1517"), so an edge landing
  // a few years past the parent's conventional end date is correct data,
  // not a bug. "Started before the parent existed" is the one unambiguous,
  // always-true invariant; "ended suspiciously long after the parent" is
  // not something a hard check can safely assert for every split.
  const backwards: string[] = [];
  for (const e of edges) {
    if (e.type !== "split_from" && e.type !== "merged_into") continue;
    const parent = byId.get(e.parent_id), child = byId.get(e.child_id);
    if (!parent || !child) continue;
    if (e.year > parent.start_year) {
      backwards.push(`${parent.name}->${child.name}: edge year ${-e.year} is before ${parent.name} started (${-parent.start_year})`);
    }
  }
  check("no structural edge predates its parent's own founding", backwards.length === 0, backwards.join("; "));

  check("every tradition has a non-empty distinctives field",
    traditions.every(t => t.distinctives.trim().length > 0),
    traditions.filter(t => !t.distinctives.trim()).map(t => t.name).join(", "));

  const badConfidence = traditions.filter(t => !["firm", "good", "uncertain"].includes(t.date_confidence));
  check("every tradition has a recognized date_confidence", badConfidence.length === 0,
    badConfidence.map(t => `${t.name}=${t.date_confidence}`).join(", "));

  const uncertainNoNote = traditions.filter(t => t.date_confidence === "uncertain" && !t.date_uncertainty_note.trim());
  check("every uncertain tradition has a note", uncertainNoNote.length === 0,
    uncertainNoNote.map(t => t.name).join(", "));

  const eventIds = new Set((await db.execute("SELECT id FROM historical_events")).rows.map((r) => (r as unknown as { id: string }).id));
  const badEventRef = edges.filter(e => e.event_id && !eventIds.has(e.event_id));
  check("every edge's event_id (where set) points at a real event", badEventRef.length === 0,
    badEventRef.map(e => e.id).join(", "));

  // ── The editorial rule itself: no side keeps the "true main church" ──────
  // At each of the four major, symmetric splits, the parent ends (it is not
  // itself also one of its own children under a reused name) and every
  // child is a distinctly-named new node dated to the split, not inheriting
  // the parent's identity.
  const majorSplits: [string, number][] = [
    ["The Early Church", 431],       // -> Church of the East, The Imperial Church
    ["The Imperial Church", 451],    // -> Oriental Orthodox, The Chalcedonian Church
    ["The Chalcedonian Church", 1054], // -> Eastern Orthodox Church, Western Church
    ["Western Church", 1517],        // -> Roman Catholic Church, Lutheran, Anglican, Anabaptist, Reformed
  ];
  for (const [parentName, splitYear] of majorSplits) {
    const parent = traditions.find(t => t.name === parentName);
    if (!parent) { check(`"${parentName}" exists to branch at ${splitYear}`, false); continue; }
    check(`"${parentName}" ends exactly at its split year (${splitYear}, not open-ended)`,
      parent.end_year === -splitYear, `end_year=${parent.end_year === null ? "null" : -parent.end_year}`);
    const children = edges.filter(e => e.parent_id === parent.id && e.type === "split_from")
      .map(e => byId.get(e.child_id)).filter((c): c is TraditionRow => !!c);
    check(`"${parentName}" has at least two structural children (a real branch, not a rename)`,
      children.length >= 2, `found ${children.length}: ${children.map(c => c.name).join(", ")}`);
    const selfNamed = children.filter(c => c.name === parentName);
    check(`no child of "${parentName}" reuses the parent's own name`, selfNamed.length === 0,
      selfNamed.map(c => c.name).join(", "));
  }

  // ── Cults: zero edges, in or out, per Hanzen's explicit instruction ──────
  const cults = traditions.filter(t => t.kind === "cult");
  check("all three cult-category traditions are present", cults.length === 3,
    `found ${cults.length}: ${cults.map(c => c.name).join(", ")}`);
  const cultIds = new Set(cults.map(c => c.id));
  const cultEdges = edges.filter(e => cultIds.has(e.parent_id) || cultIds.has(e.child_id));
  check("no cult-category tradition has ANY edge into or out of the historic tree",
    cultEdges.length === 0,
    cultEdges.map(e => `${byId.get(e.parent_id)?.name ?? e.parent_id} -${e.type}-> ${byId.get(e.child_id)?.name ?? e.child_id}`).join("; "));

  // ── Non-denominational: no structural parent ─────────────────────────────
  const nonDenom = traditions.find(t => t.name === "Non-denominational");
  if (nonDenom) {
    const structuralIn = edges.filter(e => e.child_id === nonDenom.id && (e.type === "split_from" || e.type === "merged_into"));
    check("Non-denominational has no structural (split_from/merged_into) parent",
      structuralIn.length === 0, structuralIn.map(e => byId.get(e.parent_id)?.name).join(", "));
  } else {
    check("Non-denominational tradition exists", false);
  }

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
