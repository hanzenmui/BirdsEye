"use client";
import { useMemo, useRef, useReducer, useEffect, useCallback, useState } from "react";
import type { Tradition, TraditionEdge, TraditionEdgeType } from "@/lib/types";
import { formatOpenYearSpan, formatYear } from "@/lib/timeline-layout";

// Overlay edge colors — split_from is the solid structural line drawn by the
// layout itself (styled via .ft-parent-edge, same as the family tree's
// parent_of lines); these three are the decorative/secondary edge types,
// drawn as dashed or dotted overlays on top of already-positioned nodes,
// exactly like the family tree's dashed spouse_of line.
const MERGE_COLOR = "#7c5cbf";
const INFLUENCE_COLOR = "#c98a3b";
const RENEWAL_COLOR = "#3b8fc9";

const KIND_COLORS: Record<string, string> = {
  communion: "#2E7167",
  tradition: "#8a6d3b",
  denomination: "#5b7a9e",
  movement: "#a35c2b",
  cult: "#7a7a7a",
};

const EDGE_TYPE_LABELS: Record<TraditionEdgeType, string> = {
  split_from: "Split from",
  merged_into: "Merged into",
  influenced_by: "Influenced by",
  renewal_within: "Renewal within",
};

const NW = 168;  // node width — wide enough for most denomination names
const NH = 46;
const HG = 22;
const VG = 74;
const PAD = 48;

interface TN { id: string; name: string; x: number; y: number; children: TN[] }

// Builds a forest laid out purely from split_from edges (the one edge type
// every tradition has at most one of, into itself) — merged_into,
// influenced_by and renewal_within never affect position, only get drawn as
// overlay lines afterward, the same way the family tree treats spouse_of as
// a decorative line between two nodes whose position parent_of already
// determined. A tradition with no split_from parent (Non-denominational, or
// any cult, which per the app's design has zero edges at all) becomes the
// root of its own single-node tree rather than being dropped.
function buildTraditionForest(traditions: Tradition[], edges: TraditionEdge[]) {
  const byId = new Map(traditions.map(t => [t.id, t]));
  const parentOf = new Map<string, string>();
  const childrenOf = new Map<string, string[]>();
  for (const e of edges) {
    if (e.type !== "split_from") continue;
    if (!byId.has(e.parentId) || !byId.has(e.childId)) continue;
    if (parentOf.has(e.childId)) continue;
    parentOf.set(e.childId, e.parentId);
    if (!childrenOf.has(e.parentId)) childrenOf.set(e.parentId, []);
    childrenOf.get(e.parentId)!.push(e.childId);
  }

  // startYear is stored BC-positive/AD-negative, so earliest-first
  // chronological order is DESCENDING numeric order (same convention as the
  // rest of the app — see formatYear).
  const chronological = (a: string, b: string) => (byId.get(b)?.startYear ?? 0) - (byId.get(a)?.startYear ?? 0);

  const visited = new Set<string>();
  function build(id: string, gen: number): TN {
    visited.add(id);
    const kids = (childrenOf.get(id) ?? [])
      .filter(c => byId.has(c) && !visited.has(c))
      .sort(chronological)
      .map(c => build(c, gen + 1));
    return { id, name: byId.get(id)!.name, x: 0, y: PAD + gen * (NH + VG), children: kids };
  }

  const roots = traditions.filter(t => !parentOf.has(t.id)).sort((a, b) => chronological(a.id, b.id));
  const trees = roots.map(t => build(t.id, 0));

  let cursor = 0;
  function assignX(n: TN) {
    if (n.children.length === 0) {
      n.x = PAD + cursor++ * (NW + HG) + NW / 2;
      return;
    }
    n.children.forEach(assignX);
    n.x = (n.children[0].x + n.children[n.children.length - 1].x) / 2;
  }
  trees.forEach(assignX);

  const all: TN[] = [];
  function collect(n: TN) { all.push(n); n.children.forEach(collect); }
  trees.forEach(collect);

  if (all.length === 0) return { all, w: PAD * 2, h: PAD * 2 };

  const minX = Math.min(...all.map(n => n.x - NW / 2));
  if (minX < PAD) all.forEach(n => { n.x += PAD - minX; });

  const w = Math.max(...all.map(n => n.x)) + NW / 2 + PAD;
  const h = Math.max(...all.map(n => n.y)) + NH + PAD;
  return { all, w, h };
}

// ── View state (zoom + pan) — identical mechanics to FamilyTree's, copied
// rather than imported since it has zero Person/tradition-specific logic.
interface ViewState { zoom: number; pan: { x: number; y: number } }
interface ViewFrame { vpW: number; vpH: number; insetLeft?: number; insetRight?: number; insetTop?: number; insetBottom?: number }
type ViewAction =
  | { type: "PINCH"; delta: number; cx: number; cy: number }
  | { type: "PAN"; dx: number; dy: number }
  | ({ type: "FIT"; treeW: number; treeH: number } & ViewFrame)
  | ({ type: "CENTER"; nodeX: number; nodeY: number; zoom?: number; topOffset?: number } & ViewFrame);

const CENTER_TOP_OFFSET = 138;

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
      const left = a.insetLeft ?? 0, right = a.insetRight ?? 0, top = a.insetTop ?? 0, bottom = a.insetBottom ?? 0;
      const usableW = Math.max(a.vpW - left - right, 1);
      const usableH = Math.max(a.vpH - top - bottom, 1);
      const scale = Math.min(usableW / a.treeW, usableH / a.treeH, 1);
      return { zoom: scale, pan: { x: left + (usableW - a.treeW * scale) / 2, y: top + (usableH - a.treeH * scale) / 2 } };
    }
    case "CENTER": {
      const z = a.zoom ?? s.zoom;
      const left = a.insetLeft ?? 0, right = a.insetRight ?? 0;
      return {
        zoom: z,
        pan: {
          x: left + (a.vpW - left - right) / 2 - a.nodeX * z,
          y: (a.topOffset ?? CENTER_TOP_OFFSET) - a.nodeY * z,
        },
      };
    }
  }
}

interface Props {
  traditions: Tradition[];
  edges: TraditionEdge[];
  title: string;
  subtitle: string;
  onExitCategory: () => void;
}

export function TraditionTree({ traditions, edges, title, subtitle, onExitCategory }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const didDrag = useRef(false);
  const hasFitted = useRef(false);
  const [view, dispatch] = useReducer(viewReducer, { zoom: 1, pan: { x: 0, y: 0 } });

  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const byId = useMemo(() => new Map(traditions.map(t => [t.id, t])), [traditions]);

  const tree = useMemo(
    () => (traditions.length ? buildTraditionForest(traditions, edges) : null),
    [traditions, edges],
  );
  const posMap = useMemo(() => new Map(tree ? tree.all.map(n => [n.id, n]) : []), [tree]);

  const overlayEdges = useMemo(() => edges.filter(e => e.type !== "split_from"), [edges]);

  const generationDepth = useMemo(() => {
    if (!tree?.all.length) return 0;
    return Math.max(...tree.all.map(n => Math.round((n.y - PAD) / (NH + VG)))) + 1;
  }, [tree]);

  const searchHits = useMemo(() => {
    if (!search.trim()) return new Set<string>();
    const q = search.toLowerCase();
    return new Set(
      traditions.filter(t => t.name.toLowerCase().includes(q) || t.alsoKnownAs.toLowerCase().includes(q)).map(t => t.id),
    );
  }, [traditions, search]);
  const hasFilter = search.trim() !== "";

  const searchSuggestions = useMemo(() => {
    if (!search.trim() || !searchOpen) return [];
    const q = search.toLowerCase();
    return traditions.filter(t => t.name.toLowerCase().includes(q) || t.alsoKnownAs.toLowerCase().includes(q)).slice(0, 8);
  }, [traditions, search, searchOpen]);

  const detailTradition = useMemo(() => (detailId ? byId.get(detailId) ?? null : null), [byId, detailId]);
  const detailParentEdges = useMemo(
    () => (detailId ? edges.filter(e => e.childId === detailId) : []),
    [edges, detailId],
  );
  const detailChildEdges = useMemo(
    () => (detailId ? edges.filter(e => e.parentId === detailId).sort((a, b) => b.year - a.year) : []),
    [edges, detailId],
  );

  const getViewFrame = useCallback((reserveDetail: boolean): ViewFrame => {
    if (!containerRef.current) return { vpW: 0, vpH: 0 };
    const { width, height } = containerRef.current.getBoundingClientRect();
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    return {
      vpW: width,
      vpH: height,
      insetRight: !isMobile && reserveDetail ? 300 : 0,
      insetTop: isMobile ? 132 : 92,
      insetBottom: 54,
    };
  }, []);

  const zoomBy = useCallback((delta: number) => {
    if (!containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    dispatch({ type: "PINCH", delta, cx: width / 2, cy: height / 2 });
  }, []);

  const jumpTo = useCallback((id: string) => {
    if (!containerRef.current) return;
    const node = posMap.get(id);
    if (!node) return;
    const frame = getViewFrame(true);
    const topOffset = window.matchMedia("(max-width: 768px)").matches ? 184 : CENTER_TOP_OFFSET;
    dispatch({ type: "CENTER", nodeX: node.x, nodeY: node.y, zoom: Math.max(view.zoom, 0.82), topOffset, ...frame });
    setDetailId(id);
  }, [getViewFrame, posMap, view.zoom]);

  const fitView = useCallback(() => {
    if (!containerRef.current || !tree) return;
    const frame = getViewFrame(detailId !== null);
    if (frame.vpW === 0 || frame.vpH === 0) return;
    dispatch({ type: "FIT", treeW: tree.w, treeH: tree.h, ...frame });
  }, [getViewFrame, tree, detailId]);

  useEffect(() => {
    if (!tree || !containerRef.current) return;
    const el = containerRef.current;
    const tryFit = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      const isMobile = window.matchMedia("(max-width: 768px)").matches;
      const frame: ViewFrame = { vpW: width, vpH: height, insetTop: isMobile ? 132 : 92, insetBottom: 54 };
      if (!hasFitted.current) {
        dispatch({ type: "FIT", treeW: tree.w, treeH: tree.h, ...frame });
        hasFitted.current = true;
      }
    };
    tryFit();
    const ro = new ResizeObserver(tryFit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tree]);

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

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey) {
        const factor = e.deltaMode === 1 ? 0.12 : 0.008;
        const rect = el.getBoundingClientRect();
        dispatch({ type: "PINCH", delta: -e.deltaY * factor, cx: e.clientX - rect.left, cy: e.clientY - rect.top });
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

  const lastTouches = useRef<{ x: number; y: number }[]>([]);
  const isOverlayTouch = useCallback((target: EventTarget | null) => {
    return target instanceof Element && !!target.closest(
      ".ft-mapbar, .ft-controls-tr, .ft-legend, .ft-zoom, .ft-detail-panel, button, input, select, a",
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
        const prevDist = Math.hypot(lastTouches.current[0].x - lastTouches.current[1].x, lastTouches.current[0].y - lastTouches.current[1].y);
        const currDist = Math.hypot(touches[0].x - touches[1].x, touches[0].y - touches[1].y);
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
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: false });
    el.addEventListener("touchcancel", onTouchEnd, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [tree, isOverlayTouch]);

  if (traditions.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">⛪</div>
        <div className="empty-state-title">No traditions in the database</div>
        <div className="empty-state-sub">Seed the database to see this map.</div>
      </div>
    );
  }

  const { all, w, h } = tree!;
  const { zoom, pan } = view;
  const panelOpen = detailTradition !== null;

  return (
    <div
      ref={containerRef}
      className={`ft-canvas${zoom < 0.42 ? " ft-overview" : ""}`}
      aria-label={`Interactive map of ${title.toLowerCase()}. Drag to move and use the controls to zoom.`}
      style={{ position: "relative", flex: 1, overflow: "hidden", userSelect: "none", touchAction: "none", overscrollBehavior: "none" }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <div style={{ position: "absolute", transformOrigin: "0 0", transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`, willChange: "transform" }}>
        <svg width={w} height={h} style={{ display: "block", overflow: "visible" }}>
          {Array.from({ length: generationDepth }).map((_, generation) => (
            <line
              key={`generation-${generation}`}
              className="ft-generation-rule"
              x1={PAD / 2} y1={PAD + generation * (NH + VG) + NH + VG / 2}
              x2={w - PAD / 2} y2={PAD + generation * (NH + VG) + NH + VG / 2}
            />
          ))}

          {/* Structural split_from connectors */}
          {all.filter(n => n.children.length > 0).map(n => {
            const yBot = n.y + NH;
            const yMid = yBot + VG / 2;
            const xL = n.children[0].x;
            const xR = n.children[n.children.length - 1].x;
            return (
              <g key={`e${n.id}`} className="ft-parent-edge" strokeWidth="1.65" fill="none">
                <line x1={n.x} y1={yBot} x2={n.x} y2={yMid} />
                {xL !== xR && <line x1={xL} y1={yMid} x2={xR} y2={yMid} />}
                {n.children.map(c => <line key={c.id} x1={c.x} y1={yMid} x2={c.x} y2={c.y} />)}
              </g>
            );
          })}

          {/* Decorative overlays: merged_into / influenced_by / renewal_within —
              drawn only where both ends resolved to a position (split_from is
              what actually determines position; these never do). */}
          {overlayEdges.filter(e => posMap.has(e.parentId) && posMap.has(e.childId)).map(e => {
            const nA = posMap.get(e.parentId)!, nB = posMap.get(e.childId)!;
            const color = e.type === "merged_into" ? MERGE_COLOR : e.type === "influenced_by" ? INFLUENCE_COLOR : RENEWAL_COLOR;
            const dash = e.type === "merged_into" ? "6 5" : "2 5";
            return (
              <line
                key={e.id}
                x1={nA.x} y1={nA.y + NH / 2} x2={nB.x} y2={nB.y + NH / 2}
                stroke={color} strokeWidth={1.6} strokeDasharray={dash} opacity={0.55}
              />
            );
          })}

          {/* Tradition nodes */}
          {all.map(n => {
            const t = byId.get(n.id);
            const isHighlighted = searchHits.has(n.id);
            const isSelected = detailId === n.id;
            const isDimmed = hasFilter && !isHighlighted && !isSelected;
            const strokeColor = isSelected ? "#2E7167" : isHighlighted ? "#f59e0b" : undefined;
            const strokeW = isSelected ? 3 : 2.25;
            const kindColor = t ? KIND_COLORS[t.kind] : undefined;
            return (
              <g
                key={n.id}
                className="ft-node"
                transform={`translate(${n.x - NW / 2},${n.y})`}
                onClick={() => { if (didDrag.current) return; setDetailId(detailId === n.id ? null : n.id); }}
                onKeyDown={e => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  e.preventDefault();
                  setDetailId(detailId === n.id ? null : n.id);
                }}
                role="button"
                tabIndex={0}
                aria-label={`Open ${n.name}`}
                style={{ cursor: "pointer", opacity: isDimmed ? 0.25 : 1 }}
              >
                {zoom < 0.42 ? (
                  <circle
                    className="ft-overview-dot"
                    cx={NW / 2} cy={NH / 2} r={Math.min(4 / zoom, 28)}
                    vectorEffect="non-scaling-stroke"
                    style={strokeColor ? { fill: strokeColor, stroke: strokeColor } : undefined}
                  />
                ) : (
                  <>
                    <rect className="ft-node-rect" width={NW} height={NH} rx={7} style={strokeColor ? { stroke: strokeColor, strokeWidth: strokeW } : undefined} />
                    {kindColor && <circle className="ft-gender-mark" cx={14} cy={NH / 2} r={3.25} style={{ fill: kindColor, opacity: 0.75 }} />}
                    <text className="ft-node-text" x={NW / 2 + 4} y={NH / 2} textAnchor="middle" dominantBaseline="middle">
                      {n.name.length > 22 ? n.name.slice(0, 21) + "…" : n.name}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className={`ft-mapbar${panelOpen ? " panel-open" : ""}`} style={{ left: 12, right: panelOpen ? 292 : 12 }} onMouseDown={e => e.stopPropagation()}>
        <div className="ft-mapbar-context">
          <button type="button" className="ft-back-button" onClick={onExitCategory} aria-label="Back to family tree categories">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div className="ft-mapbar-heading">
            <span>{subtitle}</span>
            <strong>{title}</strong>
            <small>{all.length} {all.length === 1 ? "tradition" : "traditions"} · {generationDepth} {generationDepth === 1 ? "generation" : "generations"} deep</small>
          </div>
        </div>

        <div className="ft-controls-tr">
          <div className={`ft-field ft-person-search${search ? " active" : ""}`}>
            <label htmlFor="tt-search">Find a tradition</label>
            <div className="ft-field-control">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input
                id="tt-search"
                value={search}
                onChange={e => { setSearch(e.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => setTimeout(() => setSearchOpen(false), 120)}
                placeholder="Search names"
                autoComplete="off"
              />
              {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search">×</button>}
            </div>
            {searchOpen && searchSuggestions.length > 0 && (
              <div className="ft-suggestions ft-search-suggestions">
                {searchSuggestions.map(t => (
                  <button type="button" key={t.id} onClick={() => { setSearch(t.name); setSearchOpen(false); jumpTo(t.id); }}>
                    <span>{t.name}</span>
                    {t.alsoKnownAs && <small>{t.alsoKnownAs.split(",")[0].trim()}</small>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {hasFilter && (
          <div className={`ft-match-status${searchHits.size === 0 ? " empty" : ""}`}>
            {searchHits.size === 0 ? "No matches in this map" : `${searchHits.size} ${searchHits.size === 1 ? "match" : "matches"} highlighted`}
          </div>
        )}
      </div>

      <div className="ft-legend" style={{ left: 16 }} onMouseDown={e => e.stopPropagation()}>
        <div className="ft-legend-title">Map key</div>
        <div className="ft-legend-item">
          <svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="currentColor" strokeWidth="2" /></svg>
          <span>Split from</span>
        </div>
        <div className="ft-legend-item">
          <svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke={MERGE_COLOR} strokeWidth="2" strokeDasharray="5 4" /></svg>
          <span>Merged into</span>
        </div>
        <div className="ft-legend-item">
          <svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke={INFLUENCE_COLOR} strokeWidth="2" strokeDasharray="2 4" /></svg>
          <span>Influenced by</span>
        </div>
        <div className="ft-legend-item">
          <svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke={RENEWAL_COLOR} strokeWidth="2" strokeDasharray="2 4" /></svg>
          <span>Renewal within</span>
        </div>
      </div>

      {zoom < 0.42 && (
        <div className="ft-overview-note" onMouseDown={e => e.stopPropagation()}>
          <strong>Atlas view</strong>
          <span>Zoom in to read names</span>
        </div>
      )}

      <div className="ft-zoom" style={{ right: panelOpen ? 298 : 16 }}>
        <span className="ft-zoom-level">{Math.round(zoom * 100)}%</span>
        {(["−", "+"] as const).map((label, i) => (
          <button type="button" key={label} onClick={() => zoomBy(i === 0 ? -0.15 : 0.15)} title={i === 0 ? "Zoom out (−)" : "Zoom in (+)"}>{label}</button>
        ))}
        <button type="button" onClick={fitView} title="Show the whole map" className="ft-see-all">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M1 4V1h3M10 1h3v3M13 10v3h-3M4 13H1v-3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          See all
        </button>
      </div>

      {detailTradition && (
        <div className="ft-detail-panel" onMouseDown={e => e.stopPropagation()}>
          <div className="ft-detail-header">
            <div className="ft-detail-header-main">
              <div className="ft-detail-monogram" aria-hidden="true">{detailTradition.name.charAt(0)}</div>
              <div className="ft-detail-identity">
                <div className="ft-panel-eyebrow">Tradition profile</div>
                <div className="ft-detail-name">{detailTradition.name}</div>
                {detailTradition.alsoKnownAs && <div className="ft-detail-aka">{detailTradition.alsoKnownAs.split(",")[0].trim()}</div>}
                <div className="ft-detail-badges">
                  <span className="badge badge-tag" style={{ textTransform: "capitalize" }}>{detailTradition.kind}</span>
                  <span className="badge badge-tag">Tier {detailTradition.tier}</span>
                  {detailTradition.region && <span className="badge badge-tag">{detailTradition.region}</span>}
                </div>
                <div className="ft-detail-years">
                  <span>{formatOpenYearSpan(detailTradition.startYear, detailTradition.endYear)}</span>
                </div>
              </div>
              <button type="button" className="ft-detail-close" onClick={() => setDetailId(null)} aria-label={`Close ${detailTradition.name}'s profile`}>×</button>
            </div>
          </div>

          <div className="ft-detail-body">
            {detailTradition.description && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text3, #888)", marginBottom: 4 }}>About</div>
                <p style={{ fontSize: 12, color: "var(--text2, #4a3d1e)", lineHeight: 1.65, margin: 0, fontFamily: "var(--font, serif)" }}>{detailTradition.description}</p>
              </div>
            )}

            {detailTradition.distinctives && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text3, #888)", marginBottom: 4 }}>Distinctives</div>
                <p style={{ fontSize: 12, color: "var(--text2, #4a3d1e)", lineHeight: 1.65, margin: 0, fontFamily: "var(--font, serif)" }}>{detailTradition.distinctives}</p>
              </div>
            )}

            {detailTradition.adherents && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text3, #888)", marginBottom: 4 }}>Adherents</div>
                <p style={{ fontSize: 12, color: "var(--text2, #4a3d1e)", lineHeight: 1.65, margin: 0, fontFamily: "var(--font, serif)" }}>{detailTradition.adherents}</p>
              </div>
            )}

            {detailTradition.dateConfidence === "uncertain" && detailTradition.dateUncertaintyNote && (
              <div style={{ fontSize: 11.5, color: "var(--text3, #888)", fontStyle: "italic", lineHeight: 1.5 }}>{detailTradition.dateUncertaintyNote}</div>
            )}

            {detailParentEdges.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text3, #888)", marginBottom: 6 }}>Where it came from</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {detailParentEdges.map(e => {
                    const parent = byId.get(e.parentId);
                    const inTree = parent && posMap.has(parent.id);
                    return (
                      <div key={e.id} style={{ fontSize: 12 }}>
                        <span style={{ color: "var(--text3, #888)", fontSize: 11 }}>{EDGE_TYPE_LABELS[e.type]} </span>
                        {inTree ? (
                          <button type="button" className="ft-detail-rel-link" onClick={() => jumpTo(parent!.id)}>{parent!.name}</button>
                        ) : (
                          <span className="ft-detail-rel-name">{parent?.name ?? "Unknown"}</span>
                        )}
                        <span style={{ color: "var(--text3, #888)", fontSize: 11 }}> · {formatYear(e.year)}</span>
                        {e.notes && <div style={{ fontSize: 11, color: "var(--text3, #888)", marginTop: 1, lineHeight: 1.4 }}>{e.notes}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {detailChildEdges.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text3, #888)", marginBottom: 6 }}>
                  What came from it ({detailChildEdges.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {detailChildEdges.map(e => {
                    const child = byId.get(e.childId);
                    const inTree = child && posMap.has(child.id);
                    return (
                      <div key={e.id} style={{ fontSize: 12 }}>
                        {inTree ? (
                          <button type="button" className="ft-detail-rel-link" onClick={() => jumpTo(child!.id)}>{child!.name}</button>
                        ) : (
                          <span className="ft-detail-rel-name">{child?.name ?? "Unknown"}</span>
                        )}
                        <span style={{ color: "var(--text3, #888)", fontSize: 11 }}> · {EDGE_TYPE_LABELS[e.type].toLowerCase()} · {formatYear(e.year)}</span>
                        {e.notes && <div style={{ fontSize: 11, color: "var(--text3, #888)", marginTop: 1, lineHeight: 1.4 }}>{e.notes}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!detailTradition.description && !detailTradition.distinctives && detailParentEdges.length === 0 && detailChildEdges.length === 0 && (
              <div style={{ fontSize: 12, color: "var(--text3, #888)", fontStyle: "italic" }}>No additional information recorded.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
