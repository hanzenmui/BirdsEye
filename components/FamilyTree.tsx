"use client";
import { useMemo, useRef, useReducer, useEffect, useCallback, useState } from "react";
import type { Person, Relationship, ScriptureRef } from "@/lib/types";
import {
  RELATIONSHIP_COLORS, RELATIONSHIP_LABELS, RELATIONSHIP_INVERSE_LABELS, BIBLE_BOOKS,
} from "@/lib/types";

function formatRef(r: ScriptureRef): string {
  const same = r.chapterStart === r.chapterEnd;
  if (same && r.verseStart === r.verseEnd) return `${r.book} ${r.chapterStart}:${r.verseStart}`;
  if (same) return `${r.book} ${r.chapterStart}:${r.verseStart}–${r.verseEnd}`;
  return `${r.book} ${r.chapterStart}:${r.verseStart}–${r.chapterEnd}:${r.verseEnd}`;
}

// BFS following only parent_of edges; returns Set of node IDs on the direct lineage path
function findLineagePath(rels: Relationship[], fromId: string, toId: string): Set<string> {
  if (!fromId || !toId || fromId === toId) return new Set();
  const next = new Map<string, string[]>();
  for (const r of rels) {
    if (r.type !== "parent_of") continue;
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
  if (!prev.has(toId)) return new Set();
  const nodes = new Set<string>();
  let node = toId;
  while (node) { nodes.add(node); node = prev.get(node) ?? ""; }
  return nodes;
}

// Cubic bezier that hugs the left (x=0) or right (x=treeW) SVG edge so arcs
// avoid passing through the tree interior. Stays within SVG bounds so it is
// never clipped by overflow:hidden on the container.
function outerArcPath(x1: number, y1: number, x2: number, y2: number, treeW: number): string {
  const goLeft = Math.min(x1, x2) <= treeW - Math.max(x1, x2);
  const edgeX = goLeft ? 0 : treeW;
  return `M ${x1} ${y1} C ${edgeX} ${y1} ${edgeX} ${y2} ${x2} ${y2}`;
}

const NW = 108;   // node width
const NH = 34;    // node height
const HG = 18;    // horizontal gap between sibling nodes
const VG = 60;    // vertical gap between generations
const PAD = 32;   // outer padding

interface N { id: string; name: string; x: number; y: number; children: N[] }

function buildLayout(people: Person[], rels: Relationship[], rootId: string) {
  const byId = new Map(people.map(p => [p.id, p]));
  const hasMaleParent = new Set<string>();
  const hasParent = new Set<string>();
  const childrenOf = new Map<string, string[]>();

  function addChild(parentId: string, childId: string) {
    if (!childrenOf.has(parentId)) childrenOf.set(parentId, []);
    childrenOf.get(parentId)!.push(childId);
  }

  // Pass 1: assign male parents (patrilineal preference)
  for (const r of rels) {
    if (r.type !== "parent_of") continue;
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
    if (!byId.has(r.personAId) || !byId.has(r.personBId)) continue;
    if (byId.get(r.personAId)!.gender === "male") continue;
    if (hasParent.has(r.personBId)) continue;
    hasParent.add(r.personBId);
    addChild(r.personAId, r.personBId);
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

// ── View state (zoom + pan) managed atomically via reducer ────────────────────
interface ViewState { zoom: number; pan: { x: number; y: number } }
type ViewAction =
  | { type: "PINCH"; delta: number; cx: number; cy: number }
  | { type: "PAN";   dx: number; dy: number }
  | { type: "FIT";   treeW: number; treeH: number; vpW: number; vpH: number };

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
      const scale = Math.min(a.vpW / a.treeW, a.vpH / a.treeH, 1);
      return {
        zoom: scale,
        pan: {
          x: (a.vpW - a.treeW * scale) / 2,
          y: (a.vpH - a.treeH * scale) / 2,
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
}

export function FamilyTree({ people, relationships, refs, onSelect }: Props) {
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

  // ── Detail panel ─────────────────────────────────────────────────────────────
  const [detailId, setDetailId] = useState<string | null>(null);

  const adam  = useMemo(() => people.find(p => p.name === "Adam")  ?? null, [people]);
  const jesus = useMemo(() => people.find(p => p.name === "Jesus") ?? null, [people]);
  const effectiveRootId = rootId ?? adam?.id ?? null;
  const rootPerson = useMemo(
    () => (effectiveRootId ? people.find(p => p.id === effectiveRootId) ?? null : null),
    [people, effectiveRootId],
  );
  const lineagePath = useMemo(
    () => findLineagePath(relationships, adam?.id ?? "", jesus?.id ?? ""),
    [relationships, adam, jesus],
  );

  const pickerSuggestions = useMemo(
    () => pickerQuery
      ? people.filter(p => p.name.toLowerCase().includes(pickerQuery.toLowerCase())).slice(0, 8)
      : [],
    [people, pickerQuery],
  );

  // ── Search and filter highlights ─────────────────────────────────────────────
  const nodeSearchHits = useMemo(() => {
    if (!nodeSearch.trim()) return new Set<string>();
    const q = nodeSearch.toLowerCase();
    return new Set(
      people
        .filter(p => p.name.toLowerCase().includes(q) || p.alsoKnownAs.toLowerCase().includes(q))
        .map(p => p.id),
    );
  }, [people, nodeSearch]);

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
    return people.filter(p => p.name.toLowerCase().includes(nodeSearch.toLowerCase())).slice(0, 8);
  }, [people, nodeSearch, nodeSearchOpen]);

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
    if (!effectiveRootId || people.length === 0) return null;
    return buildLayout(people, relationships, effectiveRootId);
  }, [people, relationships, effectiveRootId]);

  const posMap = useMemo(
    () => new Map(tree ? tree.all.map(n => [n.id, n]) : []),
    [tree],
  );

  const fitView = useCallback(() => {
    if (!containerRef.current || !tree) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    dispatch({ type: "FIT", treeW: tree.w, treeH: tree.h, vpW: width, vpH: height });
  }, [tree]);

  const zoomBy = useCallback((delta: number) => {
    if (!containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    dispatch({ type: "PINCH", delta, cx: width / 2, cy: height / 2 });
  }, []);

  // Auto-fit once on first load. Uses ResizeObserver because the container's
  // flex dimensions aren't available yet when the effect first runs.
  useEffect(() => {
    if (!tree || !containerRef.current) return;
    hasFitted.current = false;
    const el = containerRef.current;
    const tryFit = () => {
      if (hasFitted.current) return;
      const { width, height } = el.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      dispatch({ type: "FIT", treeW: tree.w, treeH: tree.h, vpW: width, vpH: height });
      hasFitted.current = true;
    };
    tryFit();
    const ro = new ResizeObserver(tryFit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tree]);

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
  }, []);

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

  // Touch handlers for mobile pan + pinch-to-zoom
  const lastTouches = useRef<{ x: number; y: number }[]>([]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    lastTouches.current = Array.from(e.touches).map(t => ({ x: t.clientX, y: t.clientY }));
    isDragging.current = true;
    didDrag.current = false;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
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
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    lastTouches.current = Array.from(e.touches).map(t => ({ x: t.clientX, y: t.clientY }));
    if (e.touches.length === 0) isDragging.current = false;
  }, []);

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
      style={{
        position: "relative",
        flex: 1,
        overflow: "hidden",
        background: "var(--bg)",
        cursor: isDragging.current ? "grabbing" : "grab",
        userSelect: "none",
        touchAction: "none",
        overscrollBehavior: "none",
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
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
          {/* Extra relationship arcs */}
          {relationships
            .filter(r => r.type !== "parent_of" && r.type !== "child_of")
            .filter(r => posMap.has(r.personAId) && posMap.has(r.personBId))
            .map(r => {
              const nA = posMap.get(r.personAId)!;
              const nB = posMap.get(r.personBId)!;
              const color = RELATIONSHIP_COLORS[r.type] ?? RELATIONSHIP_COLORS.other;
              const dash: Record<string, string> = {
                sibling_of:    "6 3",
                spouse_of:     "2 3",
                ancestor_of:   "10 4",
                descendant_of: "10 4",
                mentor_of:     "7 3",
                disciple_of:   "7 3",
                ally_of:       "5 3",
                servant_of:    "3 5",
                enemy_of:      "5 2 1 2",
                ruler_of:      "9 3",
                other:         "3 3",
              };
              const isAnc = r.type === "ancestor_of" || r.type === "descendant_of";
              return (
                <path
                  key={r.id}
                  d={outerArcPath(nA.x, nA.y + NH / 2, nB.x, nB.y + NH / 2, w)}
                  stroke={color}
                  strokeWidth={1.5}
                  fill="none"
                  strokeDasharray={dash[r.type] ?? "4 3"}
                  opacity={isAnc ? 0.4 : 0.8}
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
              <g key={`e${n.id}`} stroke="rgba(60,45,20,.18)" strokeWidth="1.5" fill="none">
                <line x1={n.x} y1={yBot} x2={n.x} y2={yMid} />
                {xL !== xR && <line x1={xL} y1={yMid} x2={xR} y2={yMid} />}
                {n.children.map(c => (
                  <line key={c.id} x1={c.x} y1={yMid} x2={c.x} y2={c.y} />
                ))}
              </g>
            );
          })}

          {/* Person nodes */}
          {all.map(n => {
            const onLin = lineagePath.has(n.id);
            const isHighlighted = highlightedIds.has(n.id);
            const isSelected = detailId === n.id;
            const isDimmed = hasFilter && !isHighlighted && !isSelected;
            const strokeColor = isSelected
              ? "#2563eb"
              : onLin
              ? RELATIONSHIP_COLORS.lineage
              : isHighlighted
              ? "#f59e0b"
              : undefined;
            const strokeW = isSelected ? 2.5 : 2;
            return (
              <g
                key={n.id}
                className="ft-node"
                transform={`translate(${n.x - NW / 2},${n.y})`}
                onClick={() => { if (!didDrag.current) setDetailId(prev => prev === n.id ? null : n.id); }}
                onDoubleClick={e => { e.stopPropagation(); setRootId(n.id); setPickerQuery(""); setDetailId(null); }}
                style={{ cursor: "pointer", opacity: isDimmed ? 0.25 : 1 }}
              >
                <rect
                  className="ft-node-rect"
                  width={NW}
                  height={NH}
                  rx={6}
                  style={strokeColor ? { stroke: strokeColor, strokeWidth: strokeW } : undefined}
                />
                <text
                  className="ft-node-text"
                  x={NW / 2}
                  y={NH / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {n.name.length > 13 ? n.name.slice(0, 12) + "…" : n.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* ── Root picker — top left ─────────────────────────────────────────────── */}
      <div
        style={{ position: "absolute", top: 14, left: 14, zIndex: 20, minWidth: 180 }}
        onMouseDown={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface, #fff)", border: "1px solid rgba(60,45,20,.18)", borderRadius: 8, padding: "5px 10px", boxShadow: "0 1px 4px rgba(0,0,0,.12)", opacity: 0.95 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, color: "var(--text3, #888)" }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            value={pickerFocused ? pickerQuery : (rootPerson?.name ?? "")}
            onChange={e => { setPickerQuery(e.target.value); setPickerOpen(true); }}
            onFocus={() => { setPickerFocused(true); setPickerQuery(""); setPickerOpen(true); }}
            onBlur={() => setTimeout(() => { setPickerOpen(false); setPickerFocused(false); }, 120)}
            placeholder="Root: Adam"
            style={{ border: "none", outline: "none", background: "transparent", fontSize: 13, color: "var(--text, #1a1209)", width: 130, fontFamily: "var(--ui-font, sans-serif)" }}
          />
          {rootId && (
            <button
              onClick={() => { setRootId(null); setPickerQuery(""); }}
              title="Reset to Adam"
              style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0, color: "var(--text3, #888)", fontSize: 15, lineHeight: 1, flexShrink: 0 }}
            >×</button>
          )}
        </div>
        {pickerOpen && pickerSuggestions.length > 0 && (
          <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "var(--surface, #fff)", border: "1px solid rgba(60,45,20,.18)", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,.10)", overflow: "hidden" }}>
            {pickerSuggestions.map(p => (
              <div
                key={p.id}
                onMouseDown={() => { setRootId(p.id); setPickerQuery(""); setPickerOpen(false); setPickerFocused(false); dispatch({ type: "FIT", treeW: w, treeH: h, vpW: containerRef.current?.clientWidth ?? 800, vpH: containerRef.current?.clientHeight ?? 600 }); }}
                style={{ padding: "7px 12px", fontSize: 13, cursor: "pointer", color: "var(--text, #1a1209)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--bg2, #f5f0e8)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <div>{p.name}</div>
                {p.alsoKnownAs && <div style={{ fontSize: 11, color: "var(--text3, #888)", marginTop: 1 }}>{p.alsoKnownAs.split(",")[0].trim()}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Node search + book filter — top right ─────────────────────────────── */}
      <div
        className="ft-controls-tr"
        style={{ position: "absolute", top: 14, right: panelOpen ? 298 : 14, zIndex: 20, display: "flex", gap: 6, alignItems: "flex-start" }}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Book filter */}
        <div style={{ background: "var(--surface, #fff)", border: "1px solid rgba(60,45,20,.18)", borderRadius: 8, padding: "5px 10px", boxShadow: "0 1px 4px rgba(0,0,0,.12)", opacity: 0.95, display: "flex", alignItems: "center", gap: 5 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, color: bookFilter ? "#f59e0b" : "var(--text3, #888)" }}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          <select
            value={bookFilter}
            onChange={e => setBookFilter(e.target.value)}
            style={{ border: "none", outline: "none", background: "transparent", fontSize: 12, color: bookFilter ? "#92400e" : "var(--text, #1a1209)", fontFamily: "var(--ui-font, sans-serif)", cursor: "pointer", maxWidth: 120 }}
          >
            <option value="">All books</option>
            <optgroup label="Old Testament">
              {BIBLE_BOOKS.filter(b => b.testament === "OT").map(b => (
                <option key={b.name} value={b.name}>{b.name}</option>
              ))}
            </optgroup>
            <optgroup label="New Testament">
              {BIBLE_BOOKS.filter(b => b.testament === "NT").map(b => (
                <option key={b.name} value={b.name}>{b.name}</option>
              ))}
            </optgroup>
          </select>
        </div>

        {/* Node search */}
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface, #fff)", border: "1px solid rgba(60,45,20,.18)", borderRadius: 8, padding: "5px 10px", boxShadow: "0 1px 4px rgba(0,0,0,.12)", opacity: 0.95 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, color: nodeSearch ? "#f59e0b" : "var(--text3, #888)" }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              value={nodeSearch}
              onChange={e => { setNodeSearch(e.target.value); setNodeSearchOpen(true); }}
              onFocus={() => setNodeSearchOpen(true)}
              onBlur={() => setTimeout(() => setNodeSearchOpen(false), 120)}
              placeholder="Find person…"
              style={{ border: "none", outline: "none", background: "transparent", fontSize: 13, color: "var(--text, #1a1209)", width: 110, fontFamily: "var(--ui-font, sans-serif)" }}
            />
            {(nodeSearch || bookFilter) && (
              <button
                onClick={() => { setNodeSearch(""); setBookFilter(""); }}
                title="Clear filters"
                style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0, color: "var(--text3, #888)", fontSize: 15, lineHeight: 1, flexShrink: 0 }}
              >×</button>
            )}
          </div>
          {nodeSearchOpen && nodeSearchSuggestions.length > 0 && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, minWidth: 200, background: "var(--surface, #fff)", border: "1px solid rgba(60,45,20,.18)", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,.10)", overflow: "hidden", zIndex: 21 }}>
              {nodeSearchSuggestions.map(p => (
                <div
                  key={p.id}
                  onMouseDown={() => {
                    setNodeSearch(p.name);
                    setNodeSearchOpen(false);
                    // Navigate to this person by making them the root
                    setRootId(p.id);
                    setPickerQuery("");
                    dispatch({ type: "FIT", treeW: w, treeH: h, vpW: containerRef.current?.clientWidth ?? 800, vpH: containerRef.current?.clientHeight ?? 600 });
                  }}
                  style={{ padding: "7px 12px", fontSize: 13, cursor: "pointer", color: "var(--text, #1a1209)" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--bg2, #f5f0e8)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <div>{p.name}</div>
                  {p.alsoKnownAs && <div style={{ fontSize: 11, color: "var(--text3, #888)", marginTop: 1 }}>{p.alsoKnownAs.split(",")[0].trim()}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Filter active badge ────────────────────────────────────────────────── */}
      {hasFilter && highlightedIds.size === 0 && (
        <div style={{ position: "absolute", top: 58, right: panelOpen ? 298 : 14, zIndex: 20, background: "rgba(245,158,11,.15)", border: "1px solid #f59e0b", borderRadius: 6, padding: "3px 10px", fontSize: 11, color: "#92400e", fontFamily: "var(--ui-font, sans-serif)" }}
          onMouseDown={e => e.stopPropagation()}>
          No matches in current tree
        </div>
      )}
      {hasFilter && highlightedIds.size > 0 && (
        <div style={{ position: "absolute", top: 58, right: panelOpen ? 298 : 14, zIndex: 20, background: "rgba(245,158,11,.12)", border: "1px solid rgba(245,158,11,.4)", borderRadius: 6, padding: "3px 10px", fontSize: 11, color: "#92400e", fontFamily: "var(--ui-font, sans-serif)" }}
          onMouseDown={e => e.stopPropagation()}>
          {highlightedIds.size} {highlightedIds.size === 1 ? "match" : "matches"} highlighted
        </div>
      )}

      {/* ── Relationship legend — bottom left ─────────────────────────────────── */}
      <div
        className="ft-legend"
        style={{ position: "absolute", bottom: 16, left: 14, zIndex: 10, background: "var(--surface, #fff)", border: "1px solid rgba(60,45,20,.18)", borderRadius: 8, padding: "8px 12px", boxShadow: "0 1px 4px rgba(0,0,0,.10)", opacity: 0.92, fontSize: 10.5, color: "var(--text2, #4a3d1e)", fontFamily: "var(--ui-font, sans-serif)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 14px" }}
        onMouseDown={e => e.stopPropagation()}
      >
        {([
          ["rgba(60,45,20,.75)", "Parent / Blood",   undefined],
          [RELATIONSHIP_COLORS.sibling_of,   "Sibling",      "6 3"],
          [RELATIONSHIP_COLORS.spouse_of,    "Spouse",       "2 3"],
          [RELATIONSHIP_COLORS.mentor_of,    "Mentor",       "7 3"],
          [RELATIONSHIP_COLORS.enemy_of,     "Enemy",        "5 2 1 2"],
          [RELATIONSHIP_COLORS.ally_of,      "Ally / Friend","5 3"],
          [RELATIONSHIP_COLORS.ancestor_of,  "Ancestor",     "10 4"],
          [RELATIONSHIP_COLORS.ruler_of,     "Ruler",        "9 3"],
        ] as [string, string, string | undefined][]).map(([color, label, dash]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <svg width="20" height="6" style={{ flexShrink: 0 }}>
              <line x1="0" y1="3" x2="20" y2="3" stroke={color} strokeWidth="2" strokeDasharray={dash} />
            </svg>
            <span>{label}</span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 5, gridColumn: "1 / -1", marginTop: 2, paddingTop: 4, borderTop: "1px solid rgba(60,45,20,.1)" }}>
          <svg width="14" height="10" style={{ flexShrink: 0 }}>
            <rect x="1" y="1" width="12" height="8" rx="2" fill="none" stroke={RELATIONSHIP_COLORS.lineage} strokeWidth="1.8" />
          </svg>
          <span>Adam → Jesus lineage</span>
        </div>
      </div>

      {/* ── Zoom + fit controls — bottom right ────────────────────────────────── */}
      <div
        className="ft-zoom"
        style={{
          position: "absolute",
          bottom: 16,
          right: panelOpen ? 298 : 16,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: 4,
          boxShadow: "0 1px 4px rgba(0,0,0,.12)",
          borderRadius: 8,
          overflow: "hidden",
          border: "1px solid rgba(60,45,20,.18)",
          opacity: 0.92,
        }}
        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = "1")}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = "0.92")}
      >
        {(["−", "+"] as const).map((label, i) => (
          <button
            key={label}
            onClick={() => zoomBy(i === 0 ? -0.15 : 0.15)}
            title={i === 0 ? "Zoom out (−)" : "Zoom in (+)"}
            style={{ border: "none", borderRight: "1px solid rgba(60,45,20,.18)", background: "var(--surface, #fff)", color: "var(--text, #1a1209)", fontSize: 18, fontWeight: 400, lineHeight: 1, width: 34, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--bg2, #f5f0e8)")}
            onMouseLeave={e => (e.currentTarget.style.background = "var(--surface, #fff)")}
          >{label}</button>
        ))}
        <button
          onClick={fitView}
          title="Fit to view"
          style={{ border: "none", background: "var(--surface, #fff)", color: "var(--text, #1a1209)", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, padding: "0 12px", height: 32 }}
          onMouseEnter={e => (e.currentTarget.style.background = "var(--bg2, #f5f0e8)")}
          onMouseLeave={e => (e.currentTarget.style.background = "var(--surface, #fff)")}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M1 4V1h3M10 1h3v3M13 10v3h-3M4 13H1v-3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Fit
        </button>
      </div>

      {/* ── Detail panel — right side ──────────────────────────────────────────── */}
      {detailPerson && (
        <div
          className="ft-detail-panel"
          style={{
            position: "absolute",
            top: 0, right: 0, bottom: 0,
            width: 280,
            background: "var(--surface, #fff)",
            borderLeft: "1px solid rgba(60,45,20,.18)",
            boxShadow: "-4px 0 20px rgba(0,0,0,.10)",
            zIndex: 30,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
          onMouseDown={e => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid rgba(60,45,20,.10)", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text, #1a1209)", fontFamily: "var(--font, serif)", lineHeight: 1.25 }}>
                  {detailPerson.name}
                </div>
                {detailPerson.alsoKnownAs && (
                  <div style={{ fontSize: 11, color: "var(--text3, #888)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {detailPerson.alsoKnownAs.split(",")[0].trim()}
                  </div>
                )}
                <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap" }}>
                  <span className={`badge ${detailPerson.testament === "OT" ? "badge-ot" : "badge-nt"}`}>
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
                  <div style={{ marginTop: 6, fontSize: 11, color: "var(--text3, #888)" }}>
                    {detailPerson.birthYear && <span>b. {detailPerson.birthYear}</span>}
                    {detailPerson.birthYear && detailPerson.deathYear && <span> · </span>}
                    {detailPerson.deathYear && <span>d. {detailPerson.deathYear}</span>}
                  </div>
                )}
              </div>
              <button
                onClick={() => setDetailId(null)}
                style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 18, color: "var(--text3, #888)", flexShrink: 0, lineHeight: 1, padding: "2px 4px", marginTop: -2 }}
              >×</button>
            </div>
          </div>

          {/* Scrollable body */}
          <div style={{ flex: 1, overflow: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
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
                        <span
                          style={{ color: "var(--text, #1a1209)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: inTree ? "pointer" : "default", textDecoration: inTree ? "underline" : "none", textDecorationStyle: "dotted", textUnderlineOffset: "2px" }}
                          onClick={() => { if (inTree) setDetailId(otherId); }}
                          title={inTree ? `View ${otherName} in panel` : undefined}
                        >{otherName}</span>
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
          <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(60,45,20,.10)", display: "flex", gap: 6, flexShrink: 0 }}>
            <button
              onClick={() => { setRootId(detailId); setPickerQuery(""); dispatch({ type: "FIT", treeW: w, treeH: h, vpW: containerRef.current?.clientWidth ?? 800, vpH: containerRef.current?.clientHeight ?? 600 }); }}
              style={{ flex: 1, fontSize: 12, padding: "6px 8px", background: "var(--bg2, #f5f0e8)", border: "1px solid rgba(60,45,20,.18)", borderRadius: 6, cursor: "pointer", color: "var(--text2, #4a3d1e)", fontFamily: "var(--ui-font, sans-serif)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--bg3, #ece7db)")}
              onMouseLeave={e => (e.currentTarget.style.background = "var(--bg2, #f5f0e8)")}
            >Set as root</button>
            <button
              onClick={() => { onSelect(detailId!); setDetailId(null); }}
              style={{ flex: 1, fontSize: 12, padding: "6px 8px", background: "var(--primary, #4a3d1e)", border: "none", borderRadius: 6, cursor: "pointer", color: "#fff", fontFamily: "var(--ui-font, sans-serif)" }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >View profile</button>
          </div>
        </div>
      )}
    </div>
  );
}
