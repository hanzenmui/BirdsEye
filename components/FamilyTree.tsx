"use client";
import { useMemo, useRef, useReducer, useEffect, useCallback, useState } from "react";
import type { Person, Relationship, ScriptureRef } from "@/lib/types";
import {
  RELATIONSHIP_COLORS, RELATIONSHIP_LABELS, RELATIONSHIP_INVERSE_LABELS, BIBLE_BOOKS,
} from "@/lib/types";
import { formatRef } from "@/lib/mappers";

// Resolves each person to at most one parent — male parents preferred, same
// tie-break rule buildLayout/buildForest use to lay out the tree. Shared so
// that any "is this node on the lineage path" computation walks exactly the
// edges that actually get drawn, rather than an independently-discovered
// path that the tree may not render (e.g. Joseph has parent_of edges from
// both Jacob and Heli — the tree draws only one of them, so the lineage
// path must resolve to that same one or the highlighted nodes won't connect).
function computeParentMap(people: Person[], rels: Relationship[]): Map<string, string> {
  const byId = new Map(people.map(p => [p.id, p]));
  const hasMaleParent = new Set<string>();
  const hasParent = new Set<string>();
  const parentOf = new Map<string, string>();

  // Pass 1: male parents (patrilineal preference)
  for (const r of rels) {
    if (r.type !== "parent_of") continue;
    if (!byId.has(r.personAId) || !byId.has(r.personBId)) continue;
    if (byId.get(r.personAId)!.gender !== "male") continue;
    if (hasMaleParent.has(r.personBId)) continue;
    hasMaleParent.add(r.personBId);
    hasParent.add(r.personBId);
    parentOf.set(r.personBId, r.personAId);
  }

  // Pass 2: female parents only when no male parent assigned
  for (const r of rels) {
    if (r.type !== "parent_of") continue;
    if (!byId.has(r.personAId) || !byId.has(r.personBId)) continue;
    if (byId.get(r.personAId)!.gender === "male") continue;
    if (hasParent.has(r.personBId)) continue;
    hasParent.add(r.personBId);
    parentOf.set(r.personBId, r.personAId);
  }

  return parentOf;
}

// Walks the resolved parent-of-one map from toId up to fromId; returns the
// Set of node IDs on that path (empty if fromId is never reached).
function findLineagePath(people: Person[], rels: Relationship[], fromId: string, toId: string): Set<string> {
  if (!fromId || !toId || fromId === toId) return new Set();
  const parentOf = computeParentMap(people, rels);
  const nodes = new Set<string>();
  let node: string | undefined = toId;
  while (node) {
    if (nodes.has(node)) return new Set(); // defensive: no real cycles expected in the data
    nodes.add(node);
    if (node === fromId) return nodes;
    node = parentOf.get(node);
  }
  return new Set();
}

// Forward BFS over every parent_of edge (not just the one buildLayout keeps
// per child) — used for the Solomon/Nathan royal-line split, where David's
// two sons each carry their own gospel's genealogy down to Joseph rather
// than the single tree-resolved chain findLineagePath follows. optional
// excludeEdge drops one specific (parentId, childId) edge before searching,
// which is how the Zerubbabel → Abiud/Rhesa fork is pinned to the correct
// branch instead of BFS wandering onto the far shorter Matthew-side route
// (Solomon→Jesus via Abiud is a much shorter graph distance than via Rhesa,
// so an unconstrained shortest-path search from Nathan would incorrectly
// jump onto Matthew's branch after Zerubbabel).
function findForwardPath(
  rels: Relationship[],
  fromId: string,
  toId: string,
  excludeEdge?: [string, string],
): string[] {
  if (!fromId || !toId) return [];
  const next = new Map<string, string[]>();
  for (const r of rels) {
    if (r.type !== "parent_of") continue;
    if (excludeEdge && r.personAId === excludeEdge[0] && r.personBId === excludeEdge[1]) continue;
    if (!next.has(r.personAId)) next.set(r.personAId, []);
    next.get(r.personAId)!.push(r.personBId);
  }
  const prev = new Map<string, string>([[fromId, ""]]);
  const queue = [fromId];
  while (queue.length && !prev.has(toId)) {
    const curr = queue.shift()!;
    for (const c of (next.get(curr) ?? [])) {
      if (!prev.has(c)) { prev.set(c, curr); queue.push(c); }
    }
  }
  if (!prev.has(toId)) return [];
  const path: string[] = [];
  let node = toId;
  while (node) { path.push(node); node = prev.get(node) ?? ""; }
  return path.reverse();
}

const LINEAGE_SOLOMON_COLOR = "#dc2626"; // red — Matthew's genealogy, through Solomon
const LINEAGE_NATHAN_COLOR  = "#1d4ed8"; // blue — Luke's genealogy, through Nathan


const NW = 124;   // node width
const NH = 42;    // node height
const HG = 24;    // horizontal gap between sibling nodes
const VG = 70;    // vertical gap between generations
const PAD = 48;   // outer padding

interface N { id: string; name: string; x: number; y: number; children: N[] }

function buildLayout(people: Person[], rels: Relationship[], rootId: string) {
  const byId = new Map(people.map(p => [p.id, p]));
  const parentOf = computeParentMap(people, rels);
  const childrenOf = new Map<string, string[]>();
  for (const [childId, parentId] of parentOf) {
    if (!childrenOf.has(parentId)) childrenOf.set(parentId, []);
    childrenOf.get(parentId)!.push(childId);
  }

  const visited = new Set<string>();
  function build(id: string, gen: number): N {
    visited.add(id);
    const kids = (childrenOf.get(id) ?? [])
      .filter(c => byId.has(c) && !visited.has(c))
      .map(c => build(c, gen + 1))
      .reverse(); // API returns DESC order; reverse restores seed/birth order
    return { id, name: byId.get(id)!.name, x: 0, y: PAD + gen * (NH + VG), children: kids };
  }

  const root = build(rootId, 0);

  // Post-order x assignment: leaves get sequential slots, parents center over children
  let cursor = 0;
  function assignX(n: N) {
    if (n.children.length === 0) {
      n.x = PAD + cursor++ * (NW + HG) + NW / 2;
      return;
    }
    n.children.forEach(assignX);
    n.x = (n.children[0].x + n.children[n.children.length - 1].x) / 2;
  }
  assignX(root);

  const all: N[] = [];
  function collect(n: N) { all.push(n); n.children.forEach(collect); }
  collect(root);

  // Ensure leftmost node has full padding
  const minX = Math.min(...all.map(n => n.x - NW / 2));
  if (minX < PAD) all.forEach(n => { n.x += PAD - minX; });

  const w = Math.max(...all.map(n => n.x)) + NW / 2 + PAD;
  const h = Math.max(...all.map(n => n.y)) + NH + PAD;
  return { all, w, h };
}

// Like buildLayout, but supports a member-restricted set of people that may
// not form a single connected tree (e.g. a book's cast, or a curated family
// whose spouses often have no parent_of edge back into the set). Restricts
// parent_of edges to pairs where both ends are in memberIds, finds the
// connected components of that restricted graph, and lays each one out as
// its own mini-tree side by side using the same recursion buildLayout uses.
// A member with no parent_of edge to any other member becomes its own
// single-node tree rather than being dropped.
export function buildForest(people: Person[], rels: Relationship[], memberIds: Set<string>) {
  const byId = new Map(people.map(p => [p.id, p]));
  const hasMaleParent = new Set<string>();
  const hasParent = new Set<string>();
  const childrenOf = new Map<string, string[]>();
  const parentOf = new Map<string, string>();

  function addChild(parentId: string, childId: string) {
    if (!childrenOf.has(parentId)) childrenOf.set(parentId, []);
    childrenOf.get(parentId)!.push(childId);
    parentOf.set(childId, parentId);
  }

  // Pass 1: male parents (patrilineal preference), restricted to memberIds
  for (const r of rels) {
    if (r.type !== "parent_of") continue;
    if (!memberIds.has(r.personAId) || !memberIds.has(r.personBId)) continue;
    if (!byId.has(r.personAId) || !byId.has(r.personBId)) continue;
    if (byId.get(r.personAId)!.gender !== "male") continue;
    if (hasMaleParent.has(r.personBId)) continue;
    hasMaleParent.add(r.personBId);
    hasParent.add(r.personBId);
    addChild(r.personAId, r.personBId);
  }

  // Pass 2: female parents only when no male parent assigned
  for (const r of rels) {
    if (r.type !== "parent_of") continue;
    if (!memberIds.has(r.personAId) || !memberIds.has(r.personBId)) continue;
    if (!byId.has(r.personAId) || !byId.has(r.personBId)) continue;
    if (byId.get(r.personAId)!.gender === "male") continue;
    if (hasParent.has(r.personBId)) continue;
    hasParent.add(r.personBId);
    addChild(r.personAId, r.personBId);
  }

  // Each member's topmost ancestor within the restricted graph identifies
  // its connected component. Members with no parent_of edge at all become
  // their own topmost ancestor (a singleton component).
  function topmost(id: string): string {
    let cur = id;
    const seen = new Set([cur]);
    while (parentOf.has(cur)) {
      const next = parentOf.get(cur)!;
      if (seen.has(next)) break; // defensive: no real cycles expected in the data
      cur = next;
      seen.add(cur);
    }
    return cur;
  }

  const rootsInOrder: string[] = [];
  const seenRoots = new Set<string>();
  for (const id of memberIds) {
    if (!byId.has(id)) continue;
    const root = topmost(id);
    if (!seenRoots.has(root)) { seenRoots.add(root); rootsInOrder.push(root); }
  }

  const visited = new Set<string>();
  function build(id: string, gen: number): N {
    visited.add(id);
    const kids = (childrenOf.get(id) ?? [])
      .filter(c => byId.has(c) && !visited.has(c))
      .map(c => build(c, gen + 1))
      .reverse(); // API returns DESC order; reverse restores seed/birth order
    return { id, name: byId.get(id)!.name, x: 0, y: PAD + gen * (NH + VG), children: kids };
  }

  const trees = rootsInOrder.map(id => build(id, 0));

  // Single shared cursor across every tree in the forest — this naturally
  // lays every tree out left-to-right in one pass, same as buildLayout does
  // for a single tree's leaves.
  let cursor = 0;
  function assignX(n: N) {
    if (n.children.length === 0) {
      n.x = PAD + cursor++ * (NW + HG) + NW / 2;
      return;
    }
    n.children.forEach(assignX);
    n.x = (n.children[0].x + n.children[n.children.length - 1].x) / 2;
  }
  trees.forEach(assignX);

  const all: N[] = [];
  function collect(n: N) { all.push(n); n.children.forEach(collect); }
  trees.forEach(collect);

  if (all.length === 0) return { all, w: PAD * 2, h: PAD * 2 };

  const minX = Math.min(...all.map(n => n.x - NW / 2));
  if (minX < PAD) all.forEach(n => { n.x += PAD - minX; });

  const w = Math.max(...all.map(n => n.x)) + NW / 2 + PAD;
  const h = Math.max(...all.map(n => n.y)) + NH + PAD;
  return { all, w, h };
}

// ── View state (zoom + pan) managed atomically via reducer ────────────────────
interface ViewState { zoom: number; pan: { x: number; y: number } }
interface ViewFrame {
  vpW: number;
  vpH: number;
  insetLeft?: number;
  insetRight?: number;
  insetTop?: number;
  insetBottom?: number;
}
type ViewAction =
  | { type: "PINCH"; delta: number; cx: number; cy: number }
  | { type: "PAN";   dx: number; dy: number }
  | ({ type: "FIT"; treeW: number; treeH: number } & ViewFrame)
  | ({ type: "CENTER"; nodeX: number; nodeY: number; zoom?: number; topOffset?: number } & ViewFrame)
  | ({ type: "FIT_BOX"; minX: number; minY: number; maxX: number; maxY: number } & ViewFrame);

const CENTER_TOP_OFFSET = 138; // clears the genealogy toolbar on desktop and mobile

function viewReducer(s: ViewState, a: ViewAction): ViewState {
  switch (a.type) {
    case "PINCH": {
      const z = Math.max(0.08, Math.min(6, s.zoom * (1 + a.delta)));
      return {
        zoom: z,
        pan: {
          x: a.cx - (a.cx - s.pan.x) * (z / s.zoom),
          y: a.cy - (a.cy - s.pan.y) * (z / s.zoom),
        },
      };
    }
    case "PAN":
      return { ...s, pan: { x: s.pan.x + a.dx, y: s.pan.y + a.dy } };
    case "FIT": {
      const left = a.insetLeft ?? 0;
      const right = a.insetRight ?? 0;
      const top = a.insetTop ?? 0;
      const bottom = a.insetBottom ?? 0;
      const usableW = Math.max(a.vpW - left - right, 1);
      const usableH = Math.max(a.vpH - top - bottom, 1);
      const scale = Math.min(usableW / a.treeW, usableH / a.treeH, 1);
      return {
        zoom: scale,
        pan: {
          x: left + (usableW - a.treeW * scale) / 2,
          y: top + (usableH - a.treeH * scale) / 2,
        },
      };
    }
    case "CENTER":
      // Recenter in the visible map area, not underneath an open roster or
      // profile panel. Search/jump actions may also restore a readable zoom.
      const centerZoom = a.zoom ?? s.zoom;
      const centerLeft = a.insetLeft ?? 0;
      const centerRight = a.insetRight ?? 0;
      return {
        zoom: centerZoom,
        pan: {
          x: centerLeft + (a.vpW - centerLeft - centerRight) / 2 - a.nodeX * centerZoom,
          y: (a.topOffset ?? CENTER_TOP_OFFSET) - a.nodeY * centerZoom,
        },
      };
    case "FIT_BOX": {
      // Like FIT, but frames an arbitrary sub-region of the tree (e.g. every
      // node matching the active book filter) instead of the whole thing —
      // used so filtering naturally zooms to just the matches.
      const boxW = Math.max(a.maxX - a.minX, 1);
      const boxH = Math.max(a.maxY - a.minY, 1);
      const left = a.insetLeft ?? 0;
      const right = a.insetRight ?? 0;
      const top = a.insetTop ?? 0;
      const bottom = a.insetBottom ?? 0;
      const usableW = Math.max(a.vpW - left - right, 1);
      const usableH = Math.max(a.vpH - top - bottom, 1);
      const scale = Math.min(usableW / boxW, usableH / boxH, 1);
      return {
        zoom: scale,
        pan: {
          x: left + usableW / 2 - ((a.minX + a.maxX) / 2) * scale,
          y: top + usableH / 2 - ((a.minY + a.maxY) / 2) * scale,
        },
      };
    }
  }
}

interface Props {
  people: Person[];
  relationships: Relationship[];
  refs: ScriptureRef[];
  onSelect: (id: string) => void;
  scope?: { label: string; memberIds: Set<string>; onBack: () => void };
  onExitCategory?: () => void;
}

export function FamilyTree({ people, relationships, refs, onSelect, scope, onExitCategory }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const didDrag = useRef(false);
  const hasFitted = useRef(false);
  const [view, dispatch] = useReducer(viewReducer, { zoom: 1, pan: { x: 0, y: 0 } });

  // ── Root picker state ────────────────────────────────────────────────────────
  const [rootId, setRootId] = useState<string | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerFocused, setPickerFocused] = useState(false);

  // ── Node search + book filter ────────────────────────────────────────────────
  const [nodeSearch, setNodeSearch] = useState("");
  const [nodeSearchOpen, setNodeSearchOpen] = useState(false);
  const [bookFilter, setBookFilter] = useState("");
  const [rosterQuery, setRosterQuery] = useState("");

  // ── Detail panel ─────────────────────────────────────────────────────────────
  const [detailId, setDetailId] = useState<string | null>(null);

  const adam  = useMemo(() => people.find(p => p.name === "Adam")  ?? null, [people]);
  const jesus = useMemo(() => people.find(p => p.name === "Jesus") ?? null, [people]);
  const effectiveRootId = rootId ?? adam?.id ?? null;
  const rootPerson = useMemo(
    () => (effectiveRootId ? people.find(p => p.id === effectiveRootId) ?? null : null),
    [people, effectiveRootId],
  );
  const peopleById = useMemo(() => new Map(people.map(p => [p.id, p])), [people]);

  // David's two genealogies (Matthew via Solomon, Luke via Nathan) share
  // Adam→David and Joseph→Jesus but otherwise diverge; findLineagePath's
  // single resolved-parent walk can only ever show one branch. Trace both
  // explicitly instead: a shared purple trunk (Adam→David), then a red
  // Solomon→Jesus path and a blue Nathan→Jesus path, each pinned at the
  // Zerubbabel fork so neither one BFS-shortcuts onto the other's branch.
  const david  = useMemo(() => people.find(p => p.name === "David") ?? null, [people]);
  const solomon = useMemo(() => people.find(p => p.name === "Solomon") ?? null, [people]);
  const nathanSon = useMemo(() => people.find(p => p.name === "Nathan" && p.alsoKnownAs.includes("son of David")) ?? null, [people]);
  const zerubbabel = useMemo(() => people.find(p => p.name === "Zerubbabel") ?? null, [people]);
  const abiud = useMemo(() => people.find(p => p.name === "Abiud") ?? null, [people]);
  const rhesa = useMemo(() => people.find(p => p.name === "Rhesa") ?? null, [people]);

  const trunkPath = useMemo(
    () => findLineagePath(people, relationships, adam?.id ?? "", david?.id ?? ""),
    [people, relationships, adam, david],
  );
  const solomonPath = useMemo(
    () => (zerubbabel && rhesa)
      ? findForwardPath(relationships, solomon?.id ?? "", jesus?.id ?? "", [zerubbabel.id, rhesa.id])
      : [],
    [relationships, solomon, jesus, zerubbabel, rhesa],
  );
  const nathanPath = useMemo(
    () => (zerubbabel && abiud)
      ? findForwardPath(relationships, nathanSon?.id ?? "", jesus?.id ?? "", [zerubbabel.id, abiud.id])
      : [],
    [relationships, nathanSon, jesus, zerubbabel, abiud],
  );
  const solomonIds = useMemo(() => new Set(solomonPath), [solomonPath]);
  const nathanIds = useMemo(() => new Set(nathanPath), [nathanPath]);
  // Nodes both paths claim (Shealtiel, Zerubbabel, Joseph, Jesus) render as
  // shared/purple rather than either branch color.
  const lineagePath = useMemo(() => {
    const shared = new Set(trunkPath);
    for (const id of solomonIds) if (nathanIds.has(id)) shared.add(id);
    return shared;
  }, [trunkPath, solomonIds, nathanIds]);

  // Consecutive-pair edge lists for drawing the red/blue overlays, each
  // bridged from David (the last shared/purple node) into its branch.
  const solomonEdges = useMemo(() => {
    const chain = david ? [david.id, ...solomonPath] : solomonPath;
    return chain.slice(1).map((id, i) => [chain[i], id] as [string, string]);
  }, [david, solomonPath]);
  const nathanEdges = useMemo(() => {
    const chain = david ? [david.id, ...nathanPath] : nathanPath;
    return chain.slice(1).map((id, i) => [chain[i], id] as [string, string]);
  }, [david, nathanPath]);

  const pickerSuggestions = useMemo(
    () => pickerQuery
      ? people.filter(p => p.name.toLowerCase().includes(pickerQuery.toLowerCase())).slice(0, 8)
      : [],
    [people, pickerQuery],
  );

  // ── Search and filter highlights ─────────────────────────────────────────────
  const scopedPeople = useMemo(
    () => (scope ? people.filter(p => scope.memberIds.has(p.id)) : people),
    [people, scope],
  );

  // Alphabetical roster for the left-side name list shown in scoped
  // (book/family) views — a persistent reference list separate from the
  // node-search dropdown above.
  const scopedPeopleSorted = useMemo(
    () => (scope ? [...scopedPeople].sort((a, b) => a.name.localeCompare(b.name)) : []),
    [scope, scopedPeople],
  );

  const nodeSearchHits = useMemo(() => {
    if (!nodeSearch.trim()) return new Set<string>();
    const q = nodeSearch.toLowerCase();
    return new Set(
      scopedPeople
        .filter(p => p.name.toLowerCase().includes(q) || p.alsoKnownAs.toLowerCase().includes(q))
        .map(p => p.id),
    );
  }, [scopedPeople, nodeSearch]);

  const bookHits = useMemo(() => {
    if (!bookFilter) return new Set<string>();
    return new Set(refs.filter(r => r.book === bookFilter).map(r => r.personId));
  }, [refs, bookFilter]);

  // Search wins over book filter when both active
  const highlightedIds = useMemo(() => {
    if (nodeSearch.trim()) return nodeSearchHits;
    if (bookFilter) return bookHits;
    return new Set<string>();
  }, [nodeSearch, nodeSearchHits, bookFilter, bookHits]);

  const hasFilter = nodeSearch.trim() !== "" || bookFilter !== "";

  const nodeSearchSuggestions = useMemo(() => {
    if (!nodeSearch.trim() || !nodeSearchOpen) return [];
    const query = nodeSearch.toLowerCase();
    return scopedPeople
      .filter(p => p.name.toLowerCase().includes(query) || p.alsoKnownAs.toLowerCase().includes(query))
      .slice(0, 8);
  }, [scopedPeople, nodeSearch, nodeSearchOpen]);

  // Left-side name list: the scoped book/family roster when scoped, or the
  // active book filter's matches when filtering the unscoped tree.
  const sideList = useMemo(() => {
    if (scope) return { title: scope.label, items: scopedPeopleSorted };
    if (bookFilter && bookHits.size > 0) {
      const items = people.filter(p => bookHits.has(p.id)).sort((a, b) => a.name.localeCompare(b.name));
      return { title: bookFilter, items };
    }
    return null;
  }, [scope, scopedPeopleSorted, bookFilter, bookHits, people]);

  const visibleRosterItems = useMemo(() => {
    if (!sideList) return [];
    const q = rosterQuery.trim().toLowerCase();
    if (!q) return sideList.items;
    return sideList.items.filter(p =>
      p.name.toLowerCase().includes(q) || p.alsoKnownAs.toLowerCase().includes(q),
    );
  }, [rosterQuery, sideList]);

  // ── Detail panel data ─────────────────────────────────────────────────────────
  const detailPerson = useMemo(
    () => (detailId ? people.find(p => p.id === detailId) ?? null : null),
    [people, detailId],
  );
  const detailRefs = useMemo(() => {
    if (!detailId) return [];
    return refs
      .filter(r => r.personId === detailId)
      .sort((a, b) => {
        const ba = BIBLE_BOOKS.find(bk => bk.name === a.book)?.order ?? 99;
        const bb = BIBLE_BOOKS.find(bk => bk.name === b.book)?.order ?? 99;
        return ba - bb || a.chapterStart - b.chapterStart || a.verseStart - b.verseStart;
      });
  }, [refs, detailId]);
  const detailRels = useMemo(
    () => (detailId ? relationships.filter(r => r.personAId === detailId || r.personBId === detailId) : []),
    [relationships, detailId],
  );

  const tree = useMemo(() => {
    if (people.length === 0) return null;
    if (scope) {
      const forest = buildForest(people, relationships, scope.memberIds);
      return forest.all.length === 0 ? null : forest;
    }
    if (!effectiveRootId) return null;
    return buildLayout(people, relationships, effectiveRootId);
  }, [people, relationships, effectiveRootId, scope]);

  const posMap = useMemo(
    () => new Map(tree ? tree.all.map(n => [n.id, n]) : []),
    [tree],
  );

  const generationDepth = useMemo(() => {
    if (!tree?.all.length) return 0;
    return Math.max(...tree.all.map(n => Math.round((n.y - PAD) / (NH + VG)))) + 1;
  }, [tree]);

  const getViewFrame = useCallback((reserveDetail = detailPerson !== null): ViewFrame => {
    if (!containerRef.current) return { vpW: 0, vpH: 0 };
    const { width, height } = containerRef.current.getBoundingClientRect();
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    return {
      vpW: width,
      vpH: height,
      insetLeft: !isMobile && sideList ? 280 : 0,
      insetRight: !isMobile && reserveDetail ? 300 : 0,
      insetTop: isMobile ? 132 : 92,
      insetBottom: 54,
    };
  }, [detailPerson, sideList]);

  const zoomBy = useCallback((delta: number) => {
    if (!containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    dispatch({ type: "PINCH", delta, cx: width / 2, cy: height / 2 });
  }, []);

  // Pans the current tree so the given node lands near the top-center of the
  // viewport (same CENTER behavior used when re-rooting) and opens its detail
  // panel — used by the left-side name list's click-to-jump.
  const jumpToPerson = useCallback((id: string) => {
    if (!containerRef.current) return;
    const node = posMap.get(id);
    if (!node) return;
    const frame = getViewFrame(true);
    const topOffset = window.matchMedia("(max-width: 768px)").matches ? 184 : CENTER_TOP_OFFSET;
    dispatch({
      type: "CENTER",
      nodeX: node.x,
      nodeY: node.y,
      zoom: Math.max(view.zoom, 0.82),
      topOffset,
      ...frame,
    });
    setDetailId(id);
  }, [getViewFrame, posMap, view.zoom]);

  // Bounding box (in tree coordinates) around every node the active book
  // filter matches — only meaningful on the unscoped tree, since a scoped
  // (book/family) view already lays out just its own members via
  // buildForest and hides the book filter control entirely.
  const BOX_PAD = 60;
  const bookFilterBox = useMemo(() => {
    if (scope || !bookFilter) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let found = false;
    for (const id of bookHits) {
      const n = posMap.get(id);
      if (!n) continue;
      found = true;
      minX = Math.min(minX, n.x - NW / 2);
      maxX = Math.max(maxX, n.x + NW / 2);
      minY = Math.min(minY, n.y);
      maxY = Math.max(maxY, n.y + NH);
    }
    if (!found) return null;
    return { minX: minX - BOX_PAD, minY: minY - BOX_PAD, maxX: maxX + BOX_PAD, maxY: maxY + BOX_PAD };
  }, [scope, bookFilter, bookHits, posMap]);

  // Same idea as fitView, but frames the active book-filter's matches
  // instead of the whole tree when one is set — the manual "Fit" button
  // stays consistent with the automatic filter-driven fit below.
  const fitToFilterOrView = useCallback(() => {
    if (!containerRef.current) return;
    const frame = getViewFrame();
    if (frame.vpW === 0 || frame.vpH === 0) return;
    if (bookFilterBox) {
      dispatch({ type: "FIT_BOX", ...bookFilterBox, ...frame });
    } else if (tree) {
      dispatch({ type: "FIT", treeW: tree.w, treeH: tree.h, ...frame });
    }
  }, [bookFilterBox, getViewFrame, tree]);

  // Picking a book filter naturally re-frames the view to just its matches;
  // clearing it (bookFilterBox goes back to null while bookFilter is also
  // empty) restores the full tree.
  useEffect(() => {
    if (scope) return;
    if (!containerRef.current) return;
    const frame = getViewFrame(false);
    if (frame.vpW === 0 || frame.vpH === 0) return;
    if (bookFilterBox) {
      dispatch({ type: "FIT_BOX", ...bookFilterBox, ...frame });
    } else if (!bookFilter && hasFitted.current && tree) {
      const root = tree.all[0];
      const topOffset = window.matchMedia("(max-width: 768px)").matches ? 184 : CENTER_TOP_OFFSET;
      dispatch({ type: "CENTER", nodeX: root.x, nodeY: root.y, zoom: 0.88, topOffset, ...frame });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookFilterBox, scope]);

  // Establish the first useful view once the flex container has dimensions.
  // Explicit root changes reset hasFitted so they receive the same readable
  // opening treatment; ordinary ResizeObserver callbacks leave the user's
  // current pan and zoom alone.
  useEffect(() => {
    if (!tree || !containerRef.current) return;
    const el = containerRef.current;
    const root = tree.all[0];
    const tryFit = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      const isMobile = window.matchMedia("(max-width: 768px)").matches;
      const frame: ViewFrame = {
        vpW: width,
        vpH: height,
        insetLeft: !isMobile && sideList ? 280 : 0,
        insetTop: isMobile ? 132 : 92,
        insetBottom: 54,
      };
      if (!hasFitted.current) {
        if (scope) {
          dispatch({ type: "FIT", treeW: tree.w, treeH: tree.h, ...frame });
        } else {
          // The full Adam tree is enormous. Starting at a readable scale is
          // far more useful than shrinking hundreds of names into hairlines;
          // "See all" remains available for the atlas overview.
          dispatch({
            type: "CENTER",
            nodeX: root.x,
            nodeY: root.y,
            zoom: 0.88,
            topOffset: isMobile ? 184 : CENTER_TOP_OFFSET,
            ...frame,
          });
        }
        hasFitted.current = true;
      }
    };
    tryFit();
    const ro = new ResizeObserver(tryFit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tree, scope, sideList]);

  // Keyboard +/= zoom in, - zoom out toward viewport center
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "+" && e.key !== "-" && e.key !== "=") return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      zoomBy((e.key === "-" ? -1 : 1) * 0.15);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomBy]);

  // Non-passive wheel listener — required to call preventDefault() for pinch
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey) {
        const factor = e.deltaMode === 1 ? 0.12 : 0.008;
        const rect = el.getBoundingClientRect();
        dispatch({
          type: "PINCH",
          delta: -e.deltaY * factor,
          cx: e.clientX - rect.left,
          cy: e.clientY - rect.top,
        });
      } else {
        dispatch({ type: "PAN", dx: -e.deltaX, dy: -e.deltaY });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    const prevent = (e: Event) => e.preventDefault();
    el.addEventListener("gesturestart", prevent, { passive: false } as AddEventListenerOptions);
    el.addEventListener("gesturechange", prevent, { passive: false } as AddEventListenerOptions);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("gesturestart", prevent);
      el.removeEventListener("gesturechange", prevent);
    };
  }, [tree]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isDragging.current = true;
    didDrag.current = false;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didDrag.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    dispatch({ type: "PAN", dx, dy });
  }, []);

  const onMouseUp = useCallback(() => { isDragging.current = false; }, []);

  // Touch handlers for mobile pan + pinch-to-zoom — registered as non-passive
  // so preventDefault() can block native browser scroll/zoom. Because these
  // are raw addEventListener calls on the container (not React synthetic
  // handlers), they fire on the way up the *real* DOM bubble chain before
  // React's delegated listeners ever run — so the onMouseDown={stopPropagation}
  // guards on the overlay panels (back button, search, legend, zoom controls,
  // detail/name-list panels) can't protect them from these touch handlers the
  // way they protect against the mouse-drag handlers. Every touch starting
  // inside one of those panels must be recognized and ignored here directly,
  // or taps there never reach the browser's normal tap-to-click synthesis.
  const lastTouches = useRef<{ x: number; y: number }[]>([]);

  const isOverlayTouch = useCallback((target: EventTarget | null) => {
    return target instanceof Element && !!target.closest(
      ".ft-mapbar, .ft-controls-tr, .ft-legend, .ft-zoom, .ft-detail-panel, .ft-book-list, button, input, select, a",
    );
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (isOverlayTouch(e.target)) return;
      e.preventDefault();
      lastTouches.current = Array.from(e.touches).map(t => ({ x: t.clientX, y: t.clientY }));
      isDragging.current = true;
      didDrag.current = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (isOverlayTouch(e.target)) return;
      e.preventDefault();
      const touches = Array.from(e.touches).map(t => ({ x: t.clientX, y: t.clientY }));
      if (touches.length === 1 && lastTouches.current.length >= 1) {
        const dx = touches[0].x - lastTouches.current[0].x;
        const dy = touches[0].y - lastTouches.current[0].y;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) didDrag.current = true;
        dispatch({ type: "PAN", dx, dy });
      } else if (touches.length === 2 && lastTouches.current.length === 2) {
        const prevDist = Math.hypot(
          lastTouches.current[0].x - lastTouches.current[1].x,
          lastTouches.current[0].y - lastTouches.current[1].y,
        );
        const currDist = Math.hypot(
          touches[0].x - touches[1].x,
          touches[0].y - touches[1].y,
        );
        if (prevDist > 0 && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const cx = ((touches[0].x + touches[1].x) / 2) - rect.left;
          const cy = ((touches[0].y + touches[1].y) / 2) - rect.top;
          dispatch({ type: "PINCH", delta: (currDist / prevDist) - 1, cx, cy });
        }
        didDrag.current = true;
      }
      lastTouches.current = touches;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (isOverlayTouch(e.target)) return;
      e.preventDefault();
      lastTouches.current = Array.from(e.touches).map(t => ({ x: t.clientX, y: t.clientY }));
      if (e.touches.length === 0) isDragging.current = false;
    };

    el.addEventListener("touchstart",  onTouchStart, { passive: false });
    el.addEventListener("touchmove",   onTouchMove,  { passive: false });
    el.addEventListener("touchend",    onTouchEnd,   { passive: false });
    el.addEventListener("touchcancel", onTouchEnd,   { passive: false });
    return () => {
      el.removeEventListener("touchstart",  onTouchStart);
      el.removeEventListener("touchmove",   onTouchMove);
      el.removeEventListener("touchend",    onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [tree, isOverlayTouch]);

  if (people.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🌿</div>
        <div className="empty-state-title">Loading…</div>
      </div>
    );
  }

  if (!tree) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🌿</div>
        <div className="empty-state-title">No people in the database</div>
        <div className="empty-state-sub">Seed the database to see the family tree.</div>
      </div>
    );
  }

  const { all, w, h } = tree;
  const { zoom, pan } = view;
  const panelOpen = detailPerson !== null;

  return (
    <div
      ref={containerRef}
      className={`ft-canvas${zoom < 0.42 ? " ft-overview" : ""}`}
      aria-label="Interactive Bible family tree. Drag to move and use the controls to zoom."
      style={{
        position: "relative",
        flex: 1,
        overflow: "hidden",
        userSelect: "none",
        touchAction: "none",
        overscrollBehavior: "none",
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {/* ── Scrollable SVG canvas ─────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          transformOrigin: "0 0",
          transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
          willChange: "transform",
        }}
      >
        <svg width={w} height={h} style={{ display: "block", overflow: "visible" }}>
          {/* Quiet generation rules make the reading direction obvious without
              turning the genealogy into a spreadsheet. */}
          {Array.from({ length: generationDepth }).map((_, generation) => (
            <line
              key={`generation-${generation}`}
              className="ft-generation-rule"
              x1={PAD / 2}
              y1={PAD + generation * (NH + VG) + NH + VG / 2}
              x2={w - PAD / 2}
              y2={PAD + generation * (NH + VG) + NH + VG / 2}
            />
          ))}

          {/* Dashed spouse lines read differently from the solid descent path. */}
          {relationships
            .filter(r => r.type === "spouse_of")
            .filter(r => posMap.has(r.personAId) && posMap.has(r.personBId))
            .map(r => {
              const nA = posMap.get(r.personAId)!;
              const nB = posMap.get(r.personBId)!;
              return (
                <line
                  key={r.id}
                  x1={nA.x} y1={nA.y + NH / 2}
                  x2={nB.x} y2={nB.y + NH / 2}
                  className="ft-spouse-edge"
                  strokeWidth={1.6}
                  strokeDasharray="6 5"
                />
              );
            })}

          {/* Parent-of connector lines */}
          {all.filter(n => n.children.length > 0).map(n => {
            const yBot = n.y + NH;
            const yMid = yBot + VG / 2;
            const xL = n.children[0].x;
            const xR = n.children[n.children.length - 1].x;
            return (
              <g key={`e${n.id}`} className="ft-parent-edge" strokeWidth="1.65" fill="none">
                <line x1={n.x} y1={yBot} x2={n.x} y2={yMid} />
                {xL !== xR && <line x1={xL} y1={yMid} x2={xR} y2={yMid} />}
                {n.children.map(c => (
                  <line key={c.id} x1={c.x} y1={yMid} x2={c.x} y2={c.y} />
                ))}
              </g>
            );
          })}

          {/* Solomon (red) / Nathan (blue) genealogy overlays — drawn on top of
              the neutral connector lines above, including edges (e.g. Jacob→
              Joseph, Jehoiachin→Shealtiel) that the single-parent tree layout
              doesn't draw at all, since each branch keeps its own ancestor
              positioned wherever its own unambiguous chain placed it. */}
          {solomonEdges.filter(([a, b]) => posMap.has(a) && posMap.has(b)).map(([a, b]) => {
            const nA = posMap.get(a)!, nB = posMap.get(b)!;
            return (
              <line key={`sol-${a}-${b}`}
                x1={nA.x} y1={nA.y + NH} x2={nB.x} y2={nB.y}
                stroke={LINEAGE_SOLOMON_COLOR} strokeWidth={1.75} opacity={0.55} />
            );
          })}
          {nathanEdges.filter(([a, b]) => posMap.has(a) && posMap.has(b)).map(([a, b]) => {
            const nA = posMap.get(a)!, nB = posMap.get(b)!;
            return (
              <line key={`nat-${a}-${b}`}
                x1={nA.x} y1={nA.y + NH} x2={nB.x} y2={nB.y}
                stroke={LINEAGE_NATHAN_COLOR} strokeWidth={1.75} opacity={0.55} />
            );
          })}

          {/* Person nodes */}
          {all.map(n => {
            const onLin = lineagePath.has(n.id);
            const onSolomon = !onLin && solomonIds.has(n.id);
            const onNathan = !onLin && nathanIds.has(n.id);
            const isHighlighted = highlightedIds.has(n.id);
            const isSelected = detailId === n.id;
            const isDimmed = hasFilter && !isHighlighted && !isSelected;
            const strokeColor = isSelected
              ? "#2E7167"
              : onLin
              ? RELATIONSHIP_COLORS.lineage
              : onSolomon
              ? LINEAGE_SOLOMON_COLOR
              : onNathan
              ? LINEAGE_NATHAN_COLOR
              : isHighlighted
              ? "#f59e0b"
              : undefined;
            const strokeW = isSelected ? 3 : 2.25;
            const person = peopleById.get(n.id);
            return (
              <g
                key={n.id}
                className="ft-node"
                transform={`translate(${n.x - NW / 2},${n.y})`}
                onClick={() => {
                  if (didDrag.current) return;
                  if (detailId === n.id) setDetailId(null);
                  else jumpToPerson(n.id);
                }}
                onDoubleClick={e => {
                  e.stopPropagation();
                  if (scope) return;
                  hasFitted.current = false;
                  setRootId(n.id);
                  setPickerQuery("");
                  setDetailId(null);
                }}
                onKeyDown={e => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  e.preventDefault();
                  if (detailId === n.id) setDetailId(null);
                  else jumpToPerson(n.id);
                }}
                role="button"
                tabIndex={0}
                aria-label={`Open ${n.name}${person?.alsoKnownAs ? `, also known as ${person.alsoKnownAs}` : ""}`}
                style={{ cursor: "pointer", opacity: isDimmed ? 0.25 : 1 }}
              >
                {zoom < 0.42 ? (
                  <circle
                    className="ft-overview-dot"
                    cx={NW / 2}
                    cy={NH / 2}
                    r={Math.min(4 / zoom, 28)}
                    vectorEffect="non-scaling-stroke"
                    style={strokeColor ? { fill: strokeColor, stroke: strokeColor } : undefined}
                  />
                ) : (
                  <>
                    <rect
                      className="ft-node-rect"
                      width={NW}
                      height={NH}
                      rx={7}
                      style={strokeColor ? { stroke: strokeColor, strokeWidth: strokeW } : undefined}
                    />
                    <circle
                      className={`ft-gender-mark ft-gender-${person?.gender ?? "unknown"}`}
                      cx={14}
                      cy={NH / 2}
                      r={3.25}
                    />
                    <text
                      className="ft-node-text"
                      x={NW / 2 + 4}
                      y={NH / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      {n.name.length > 15 ? n.name.slice(0, 14) + "…" : n.name}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* ── Name list — left side, scoped (book/family) views or an active
          book filter on the unscoped tree ─────────────────────────────── */}
      {sideList && (
        <div
          className="ft-book-list"
          onMouseDown={e => e.stopPropagation()}
        >
          <div className="ft-roster-header">
            <div className="ft-panel-eyebrow">People in this view</div>
            <div className="ft-roster-title-row">
              <h2>{sideList.title}</h2>
              <span>{sideList.items.length}</span>
            </div>
            <p>Select a name to bring them into focus.</p>
            {sideList.items.length > 8 && (
              <label className="ft-roster-search">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <span className="sr-only">Filter this name list</span>
                <input
                  value={rosterQuery}
                  onChange={e => setRosterQuery(e.target.value)}
                  placeholder="Filter names"
                />
                {rosterQuery && (
                  <button type="button" onClick={() => setRosterQuery("")} aria-label="Clear name filter">×</button>
                )}
              </label>
            )}
          </div>
          <div className="ft-roster-list">
            {visibleRosterItems.map((p, index) => {
              const inTree = posMap.has(p.id);
              const isActive = detailId === p.id;
              return (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => { if (inTree) jumpToPerson(p.id); }}
                  className={`ft-roster-person${isActive ? " active" : ""}`}
                  disabled={!inTree}
                  title={!inTree ? `${p.name} isn't connected to anyone else in ${sideList.title}` : undefined}
                >
                  <span className="ft-roster-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="ft-roster-name">{p.name}</span>
                  <span className="ft-roster-arrow" aria-hidden="true">→</span>
                </button>
              );
            })}
            {visibleRosterItems.length === 0 && (
              <div className="ft-roster-empty">No names match “{rosterQuery}”.</div>
            )}
          </div>
        </div>
      )}

      {/* ── One calm command bar replaces the old collection of floating boxes. */}
      <div
        className={`ft-mapbar${panelOpen ? " panel-open" : ""}${sideList ? " has-roster" : ""}`}
        style={{ left: sideList ? 292 : 12, right: panelOpen ? 292 : 12 }}
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="ft-mapbar-context">
          <button
            type="button"
            className="ft-back-button"
            onClick={scope ? scope.onBack : onExitCategory}
            aria-label={scope ? "Back to choices" : "Back to family tree categories"}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div className="ft-mapbar-heading">
            <span>Genealogy map</span>
            <strong>{scope?.label ?? `${rootPerson?.name ?? "Adam"}${(rootPerson?.name ?? "Adam").endsWith("s") ? "’" : "’s"} family`}</strong>
            <small>{all.length} people · {generationDepth} {generationDepth === 1 ? "generation" : "generations"} deep</small>
          </div>
        </div>

        <div className="ft-controls-tr">
          {!scope && (
            <div className="ft-field ft-root-picker">
              <label htmlFor="ft-root-person">Start from</label>
              <div className="ft-field-control">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22V12M12 12L6 7M12 12l6-5M6 7V4M18 7V4M6 7h12"/></svg>
                <input
                  id="ft-root-person"
                  value={pickerFocused ? pickerQuery : (rootPerson?.name ?? "")}
                  onChange={e => { setPickerQuery(e.target.value); setPickerOpen(true); }}
                  onFocus={() => { setPickerFocused(true); setPickerQuery(""); setPickerOpen(true); }}
                  onBlur={() => setTimeout(() => { setPickerOpen(false); setPickerFocused(false); }, 120)}
                  placeholder="Adam"
                  autoComplete="off"
                />
                {rootId && (
                  <button type="button" onClick={() => { hasFitted.current = false; setRootId(null); setPickerQuery(""); }} aria-label="Reset starting person to Adam">×</button>
                )}
              </div>
              {pickerOpen && pickerSuggestions.length > 0 && (
                <div className="ft-suggestions ft-root-suggestions">
                  {pickerSuggestions.map(p => (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => { hasFitted.current = false; setRootId(p.id); setPickerQuery(""); setPickerOpen(false); setPickerFocused(false); }}
                    >
                      <span>{p.name}</span>
                      {p.alsoKnownAs && <small>{p.alsoKnownAs.split(",")[0].trim()}</small>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {!scope && (
            <div className={`ft-field ft-book-filter${bookFilter ? " active" : ""}`}>
              <label htmlFor="ft-book-filter">Book</label>
              <div className="ft-field-control">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                <select id="ft-book-filter" value={bookFilter} onChange={e => setBookFilter(e.target.value)}>
                  <option value="">All books</option>
                  <optgroup label="Old Testament">
                    {BIBLE_BOOKS.filter(b => b.testament === "OT").map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                  </optgroup>
                  <optgroup label="New Testament">
                    {BIBLE_BOOKS.filter(b => b.testament === "NT").map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                  </optgroup>
                </select>
              </div>
            </div>
          )}

          <div className={`ft-field ft-person-search${nodeSearch ? " active" : ""}`}>
            <label htmlFor="ft-person-search">Find a person</label>
            <div className="ft-field-control">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input
                id="ft-person-search"
                value={nodeSearch}
                onChange={e => { setNodeSearch(e.target.value); setNodeSearchOpen(true); }}
                onFocus={() => setNodeSearchOpen(true)}
                onBlur={() => setTimeout(() => setNodeSearchOpen(false), 120)}
                placeholder="Search names"
                autoComplete="off"
              />
              {(nodeSearch || bookFilter) && (
                <button type="button" onClick={() => { setNodeSearch(""); setBookFilter(""); }} aria-label="Clear search and book filter">×</button>
              )}
            </div>
            {nodeSearchOpen && nodeSearchSuggestions.length > 0 && (
              <div className="ft-suggestions ft-search-suggestions">
                {nodeSearchSuggestions.map(p => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => {
                      setNodeSearch(p.name);
                      setNodeSearchOpen(false);
                      jumpToPerson(p.id);
                    }}
                  >
                    <span>{p.name}</span>
                    {p.alsoKnownAs && <small>{p.alsoKnownAs.split(",")[0].trim()}</small>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {hasFilter && (
          <div className={`ft-match-status${highlightedIds.size === 0 ? " empty" : ""}`}>
            {highlightedIds.size === 0
              ? "No matches in this map"
              : `${highlightedIds.size} ${highlightedIds.size === 1 ? "person" : "people"} highlighted`}
          </div>
        )}
      </div>

      {/* ── Relationship legend — bottom left ─────────────────────────────────── */}
      <div
        className="ft-legend"
        style={{ left: sideList ? 296 : 16 }}
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="ft-legend-title">Map key</div>
        <div className="ft-legend-item">
          <svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="currentColor" strokeWidth="2" /></svg>
          <span>Parent to child</span>
        </div>
        <div className="ft-legend-item">
          <svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="currentColor" strokeWidth="2" strokeDasharray="5 4" /></svg>
          <span>Spouse</span>
        </div>
        {([
          [RELATIONSHIP_COLORS.lineage, "Shared line to Jesus"],
          [LINEAGE_SOLOMON_COLOR, "Matthew · through Solomon"],
          [LINEAGE_NATHAN_COLOR, "Luke · through Nathan"],
        ] as [string, string][]).map(([color, label]) => (
          <div key={label} className="ft-legend-item ft-legend-lineage">
            <svg width="16" height="12">
              <rect x="1" y="1" width="12" height="8" rx="2" fill="none" stroke={color} strokeWidth="1.8" />
            </svg>
            <span>{label}</span>
          </div>
        ))}
      </div>

      {zoom < 0.42 && (
        <div className="ft-overview-note" onMouseDown={e => e.stopPropagation()}>
          <strong>Atlas view</strong>
          <span>Zoom in to read names</span>
        </div>
      )}

      {/* ── Zoom + fit controls — bottom right ────────────────────────────────── */}
      <div
        className="ft-zoom"
        style={{ right: panelOpen ? 298 : 16 }}
      >
        <span className="ft-zoom-level">{Math.round(zoom * 100)}%</span>
        {(["−", "+"] as const).map((label, i) => (
          <button
            type="button"
            key={label}
            onClick={() => zoomBy(i === 0 ? -0.15 : 0.15)}
            title={i === 0 ? "Zoom out (−)" : "Zoom in (+)"}
          >{label}</button>
        ))}
        <button
          type="button"
          onClick={fitToFilterOrView}
          title="Show the whole map"
          className="ft-see-all"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M1 4V1h3M10 1h3v3M13 10v3h-3M4 13H1v-3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          See all
        </button>
      </div>

      {/* ── Detail panel — right side ──────────────────────────────────────────── */}
      {detailPerson && (
        <div
          className="ft-detail-panel"
          onMouseDown={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="ft-detail-header">
            <div className="ft-detail-header-main">
              <div className="ft-detail-monogram" aria-hidden="true">{detailPerson.name.charAt(0)}</div>
              <div className="ft-detail-identity">
                <div className="ft-panel-eyebrow">Person profile</div>
                <div className="ft-detail-name">
                  {detailPerson.name}
                </div>
                {detailPerson.alsoKnownAs && (
                  <div className="ft-detail-aka">
                    {detailPerson.alsoKnownAs.split(",")[0].trim()}
                  </div>
                )}
                <div className="ft-detail-badges">
                  <span className={`badge ${detailPerson.testament === "OT" ? "badge-ot" : detailPerson.testament === "NT" ? "badge-nt" : "badge-both"}`}>
                    {detailPerson.testament === "both" ? "OT & NT" : detailPerson.testament}
                  </span>
                  {detailPerson.gender !== "unknown" && (
                    <span className="badge badge-tag">{detailPerson.gender}</span>
                  )}
                  {detailPerson.tags.slice(0, 2).map(t => (
                    <span key={t} className="badge badge-tag">{t}</span>
                  ))}
                </div>
                {(detailPerson.birthYear || detailPerson.deathYear) && (
                  <div className="ft-detail-years">
                    {detailPerson.birthYear && <span>b. {detailPerson.birthYear}</span>}
                    {detailPerson.birthYear && detailPerson.deathYear && <span> · </span>}
                    {detailPerson.deathYear && <span>d. {detailPerson.deathYear}</span>}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="ft-detail-close"
                onClick={() => setDetailId(null)}
                aria-label={`Close ${detailPerson.name}'s profile`}
              >×</button>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="ft-detail-body">
            {detailPerson.description && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text3, #888)", marginBottom: 4 }}>About</div>
                <p style={{ fontSize: 12, color: "var(--text2, #4a3d1e)", lineHeight: 1.65, margin: 0, fontFamily: "var(--font, serif)" }}>
                  {detailPerson.description}
                </p>
              </div>
            )}

            {detailRels.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text3, #888)", marginBottom: 6 }}>
                  Relationships ({detailRels.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {detailRels.slice(0, 15).map(r => {
                    const isA = r.personAId === detailId;
                    const otherName = isA ? r.personBName : r.personAName;
                    const otherId   = isA ? r.personBId   : r.personAId;
                    const label = isA
                      ? (RELATIONSHIP_LABELS[r.type] ?? r.type)
                      : (RELATIONSHIP_INVERSE_LABELS[r.type] ?? r.type);
                    const inTree = posMap.has(otherId);
                    return (
                      <div key={r.id} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, minWidth: 0 }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: RELATIONSHIP_COLORS[r.type] ?? "#888", flexShrink: 0, display: "inline-block" }} />
                        <span style={{ color: "var(--text3, #888)", fontSize: 11, flexShrink: 0, minWidth: 52 }}>{label}</span>
                        {inTree ? (
                          <button
                            type="button"
                            className="ft-detail-rel-link"
                            onClick={() => jumpToPerson(otherId)}
                            title={`Bring ${otherName} into focus`}
                          >{otherName}</button>
                        ) : (
                          <span className="ft-detail-rel-name">{otherName}</span>
                        )}
                      </div>
                    );
                  })}
                  {detailRels.length > 15 && (
                    <div style={{ fontSize: 11, color: "var(--text3, #888)", fontStyle: "italic" }}>
                      + {detailRels.length - 15} more — view full profile
                    </div>
                  )}
                </div>
              </div>
            )}

            {detailRefs.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text3, #888)", marginBottom: 6 }}>
                  Scripture ({detailRefs.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {detailRefs.map(r => (
                    <div key={r.id} style={{ fontSize: 12 }}>
                      <span style={{ fontWeight: 600, color: "var(--text, #1a1209)", fontFamily: "var(--mono, monospace)", fontSize: 11 }}>{formatRef(r)}</span>
                      {r.note && <div style={{ fontSize: 11, color: "var(--text3, #888)", marginTop: 1, lineHeight: 1.4 }}>{r.note}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detailRefs.length === 0 && detailRels.length === 0 && !detailPerson.description && (
              <div style={{ fontSize: 12, color: "var(--text3, #888)", fontStyle: "italic" }}>No additional information recorded.</div>
            )}
          </div>

          {/* Footer actions */}
          <div className="ft-detail-footer">
            {!scope && (
              <button
                type="button"
                className="ft-detail-secondary"
                onClick={() => { hasFitted.current = false; setRootId(detailId); setPickerQuery(""); setDetailId(null); }}
              >Start tree here</button>
            )}
            <button
              type="button"
              className="ft-detail-primary"
              onClick={() => { onSelect(detailId!); setDetailId(null); }}
            >View profile</button>
          </div>
        </div>
      )}
    </div>
  );
}
