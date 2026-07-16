"use client";
import { useMemo, useState } from "react";
import type { Person, Relationship, ScriptureRef } from "@/lib/types";
import { BIBLE_BOOKS } from "@/lib/types";
import { FAMILIES, resolveFamilyMembers } from "@/lib/families";
import { FamilyTree } from "./FamilyTree";

interface Props {
  people: Person[];
  relationships: Relationship[];
  refs: ScriptureRef[];
  onSelect: (id: string) => void;
}

type Step1 = "all" | "families" | "books";

export function TreeCategoryPicker({ people, relationships, refs, onSelect }: Props) {
  const [step1, setStep1] = useState<Step1 | null>(null);
  const [familyKey, setFamilyKey] = useState<string | null>(null);
  const [bookName, setBookName] = useState<string | null>(null);

  const bookCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of BIBLE_BOOKS) {
      counts.set(b.name, new Set(refs.filter(r => r.book === b.name).map(r => r.personId)).size);
    }
    return counts;
  }, [refs]);

  const familyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of FAMILIES) counts.set(f.key, resolveFamilyMembers(people, f).size);
    return counts;
  }, [people]);

  // "All" — the plain, unscoped tree, unchanged from today's behavior aside
  // from the added back-to-categories button (onExitCategory).
  if (step1 === "all") {
    return (
      <FamilyTree
        people={people}
        relationships={relationships}
        refs={refs}
        onSelect={onSelect}
        onExitCategory={() => setStep1(null)}
      />
    );
  }

  // A family has been picked — render the scoped tree. key= forces a fresh
  // FamilyTree instance per family so it auto-fits instead of trying to
  // recenter at whatever zoom the previous category was left at.
  if (familyKey) {
    const family = FAMILIES.find(f => f.key === familyKey)!;
    const memberIds = resolveFamilyMembers(people, family);
    return (
      <FamilyTree
        key={`family:${familyKey}`}
        people={people}
        relationships={relationships}
        refs={refs}
        onSelect={onSelect}
        scope={{ label: family.label, memberIds, onBack: () => setFamilyKey(null) }}
      />
    );
  }

  // A book has been picked — same idea, scoped to that book's cast.
  if (bookName) {
    const memberIds = new Set(refs.filter(r => r.book === bookName).map(r => r.personId));
    return (
      <FamilyTree
        key={`book:${bookName}`}
        people={people}
        relationships={relationships}
        refs={refs}
        onSelect={onSelect}
        scope={{ label: bookName, memberIds, onBack: () => setBookName(null) }}
      />
    );
  }

  // Step 2: Families grid
  if (step1 === "families") {
    return (
      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={{ padding: "16px 20px 0" }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setStep1(null)}>‹ Back</button>
        </div>
        <div className="book-grid" style={{ maxWidth: 720, margin: "0 auto", padding: "20px" }}>
          {FAMILIES.map(f => (
            <div key={f.key} className="family-tile" onClick={() => setFamilyKey(f.key)}>
              <div className="family-tile-name">{f.label}</div>
              <div className="family-tile-count">
                {familyCounts.get(f.key) ?? 0} {familyCounts.get(f.key) === 1 ? "person" : "people"}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Step 2: Books grid, grouped OT/NT
  if (step1 === "books") {
    return (
      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={{ padding: "16px 20px 0" }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setStep1(null)}>‹ Back</button>
        </div>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px" }}>
          {(["OT", "NT"] as const).map(testament => (
            <div key={testament} style={{ marginBottom: 24 }}>
              <div className="section-eyebrow" style={{ marginBottom: 8 }}>
                {testament === "OT" ? "Old Testament" : "New Testament"}
              </div>
              <div className="book-grid">
                {BIBLE_BOOKS.filter(b => b.testament === testament).map(b => {
                  const count = bookCounts.get(b.name) ?? 0;
                  return (
                    <div
                      key={b.name}
                      className="book-tile"
                      onClick={() => setBookName(b.name)}
                      style={count === 0 ? { opacity: 0.35, cursor: "default", pointerEvents: "none" } : undefined}
                    >
                      <div className="book-tile-name">{b.name}</div>
                      <div className="book-tile-count">{count === 0 ? "no people" : `${count} ${count === 1 ? "person" : "people"}`}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Step 1: category type
  return (
    <div className="category-grid">
      <div className="category-tile" onClick={() => setStep1("all")}>
        <div className="category-tile-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22V12M12 12L6 7M12 12l6-5M6 7V4M18 7V4M6 7h12"/></svg>
        </div>
        <div className="category-tile-label">All</div>
        <div className="category-tile-sub">The traceable bloodline from Adam</div>
      </div>
      <div className="category-tile families" onClick={() => setStep1("families")}>
        <div className="category-tile-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <div className="category-tile-label">Families</div>
        <div className="category-tile-sub">{"Abraham's, Jacob's, Moses', and more"}</div>
      </div>
      <div className="category-tile books" onClick={() => setStep1("books")}>
        <div className="category-tile-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
        </div>
        <div className="category-tile-label">Books</div>
        <div className="category-tile-sub">See who appears in each book</div>
      </div>
    </div>
  );
}
