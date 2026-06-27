"use client";
import { useMemo, useRef, useReducer, useEffect, useCallback, useState } from "react";
import type { Person, Relationship } from "@/lib/types";

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
  onSelect: (id: string) => void;
}

export function FamilyTree({ people, relationships, onSelect }: Props) {
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

  const adam = useMemo(() => people.find(p => p.name === "Adam") ?? null, [people]);
  const effectiveRootId = rootId ?? adam?.id ?? null;
  const rootPerson = useMemo(
    () => (effectiveRootId ? people.find(p => p.id === effectiveRootId) ?? null : null),
    [people, effectiveRootId],
  );

  const pickerSuggestions = useMemo(
    () => pickerQuery
      ? people.filter(p => p.name.toLowerCase().includes(pickerQuery.toLowerCase())).slice(0, 8)
      : [],
    [people, pickerQuery],
  );

  const tree = useMemo(() => {
    if (!effectiveRootId || people.length === 0) return null;
    return buildLayout(people, relationships, effectiveRootId);
  }, [people, relationships, effectiveRootId]);

  const fitView = useCallback(() => {
    if (!containerRef.current || !tree) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    dispatch({ type: "FIT", treeW: tree.w, treeH: tree.h, vpW: width, vpH: height });
  }, [tree]);

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

  // Keyboard +/- zoom toward viewport center
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "+" && e.key !== "-" && e.key !== "=" ) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      const el = containerRef.current;
      if (!el) return;
      const { width, height } = el.getBoundingClientRect();
      dispatch({
        type: "PINCH",
        delta: (e.key === "-" ? -1 : 1) * 0.15,
        cx: width / 2,
        cy: height / 2,
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Non-passive wheel listener — required to call preventDefault() for pinch
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey) {
        // Trackpad pinch or Ctrl+scroll — zoom toward cursor
        const factor = e.deltaMode === 1 ? 0.12 : 0.008;
        const rect = el.getBoundingClientRect();
        dispatch({
          type: "PINCH",
          delta: -e.deltaY * factor,
          cx: e.clientX - rect.left,
          cy: e.clientY - rect.top,
        });
      } else {
        // Trackpad two-finger scroll or mouse wheel — pan
        dispatch({ type: "PAN", dx: -e.deltaX, dy: -e.deltaY });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
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
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <div
        style={{
          position: "absolute",
          transformOrigin: "0 0",
          transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
          willChange: "transform",
        }}
      >
        <svg width={w} height={h} style={{ display: "block", overflow: "visible" }}>
          {/* Connector lines */}
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
          {all.map(n => (
            <g
              key={n.id}
              className="ft-node"
              transform={`translate(${n.x - NW / 2},${n.y})`}
              onClick={() => { if (!didDrag.current) onSelect(n.id); }}
              onDoubleClick={e => { e.stopPropagation(); setRootId(n.id); setPickerQuery(""); }}
              style={{ cursor: "pointer" }}
            >
              <rect className="ft-node-rect" width={NW} height={NH} rx={6} />
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
          ))}
        </svg>
      </div>

      {/* Root picker overlay — top-left */}
      <div
        style={{ position: "absolute", top: 14, left: 14, zIndex: 20, minWidth: 180 }}
        onMouseDown={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface, #fff)", border: "1px solid rgba(60,45,20,.18)", borderRadius: 8, padding: "5px 10px", boxShadow: "0 1px 4px rgba(0,0,0,.12)", opacity: 0.95 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, color: "var(--text3, #888)" }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            value={pickerQuery || rootPerson?.name || ""}
            onChange={e => { setPickerQuery(e.target.value); setPickerOpen(true); }}
            onFocus={() => { setPickerQuery(""); setPickerOpen(true); }}
            onBlur={() => setTimeout(() => setPickerOpen(false), 120)}
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
                onMouseDown={() => { setRootId(p.id); setPickerQuery(""); setPickerOpen(false); dispatch({ type: "FIT", treeW: w, treeH: h, vpW: containerRef.current?.clientWidth ?? 800, vpH: containerRef.current?.clientHeight ?? 600 }); }}
                style={{ padding: "7px 12px", fontSize: 13, cursor: "pointer", color: "var(--text, #1a1209)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--bg2, #f5f0e8)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >{p.name}</div>
            ))}
          </div>
        )}
      </div>

      {/* Fit-to-view button */}
      <button
        onClick={fitView}
        title="Fit to view"
        style={{
          position: "absolute",
          bottom: 16,
          right: 16,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 12px",
          borderRadius: 8,
          border: "1px solid rgba(60,45,20,.18)",
          background: "var(--surface, #fff)",
          color: "var(--text, #1a1209)",
          fontSize: 13,
          fontWeight: 500,
          cursor: "pointer",
          boxShadow: "0 1px 4px rgba(0,0,0,.12)",
          opacity: 0.92,
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
        onMouseLeave={e => (e.currentTarget.style.opacity = "0.92")}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M1 4V1h3M10 1h3v3M13 10v3h-3M4 13H1v-3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Fit view
      </button>
    </div>
  );
}
