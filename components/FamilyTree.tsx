"use client";
import { useMemo } from "react";
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

interface Props {
  people: Person[];
  relationships: Relationship[];
  onSelect: (id: string) => void;
}

export function FamilyTree({ people, relationships, onSelect }: Props) {
  const adam = useMemo(() => people.find(p => p.name === "Adam") ?? null, [people]);

  const tree = useMemo(() => {
    if (!adam || people.length === 0) return null;
    return buildLayout(people, relationships, adam.id);
  }, [people, relationships, adam]);

  if (people.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🌿</div>
        <div className="empty-state-title">Loading…</div>
      </div>
    );
  }

  if (!adam || !tree) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🌿</div>
        <div className="empty-state-title">No people in the database</div>
        <div className="empty-state-sub">Seed the database to see the family tree.</div>
      </div>
    );
  }

  const { all, w, h } = tree;

  return (
    <div style={{ flex: 1, overflow: "auto", background: "var(--bg)" }}>
      <svg width={w} height={h} style={{ display: "block" }}>
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
            onClick={() => onSelect(n.id)}
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
  );
}
