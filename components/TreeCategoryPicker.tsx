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
      <div className="tree-chooser" key="families">
        <div className="tree-chooser-inner">
          <button type="button" className="tree-chooser-back" onClick={() => setStep1(null)}>← All tree views</button>
          <header className="tree-chooser-header">
            <span>Curated families</span>
            <h2>Choose a household</h2>
            <p>Open a focused map of the people closest to a major biblical family.</p>
          </header>
          <div className="tree-family-grid">
            {FAMILIES.map((f, index) => {
              const count = familyCounts.get(f.key) ?? 0;
              return (
                <button type="button" key={f.key} className="tree-family-card" onClick={() => setFamilyKey(f.key)}>
                  <span className="tree-family-number">{String(index + 1).padStart(2, "0")}</span>
                  <span className="tree-family-copy">
                    <strong>{f.label}</strong>
                    <small>{count} {count === 1 ? "person" : "people"}</small>
                  </span>
                  <span className="tree-family-arrow" aria-hidden="true">→</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Books grid, grouped OT/NT
  if (step1 === "books") {
    return (
      <div className="tree-chooser" key="books">
        <div className="tree-chooser-inner tree-chooser-books">
          <button type="button" className="tree-chooser-back" onClick={() => setStep1(null)}>← All tree views</button>
          <header className="tree-chooser-header">
            <span>People by book</span>
            <h2>Choose a book of the Bible</h2>
            <p>See everyone named in that book, then select any person to find them on the map.</p>
          </header>
          {(["OT", "NT"] as const).map(testament => (
            <section key={testament} className="tree-testament-section">
              <div className="tree-testament-heading">
                <span>{testament}</span>
                <strong>{testament === "OT" ? "Old Testament" : "New Testament"}</strong>
              </div>
              <div className="tree-book-grid">
                {BIBLE_BOOKS.filter(b => b.testament === testament).map(b => {
                  const count = bookCounts.get(b.name) ?? 0;
                  return (
                    <button
                      type="button"
                      key={b.name}
                      className="tree-book-card"
                      onClick={() => setBookName(b.name)}
                      disabled={count === 0}
                    >
                      <span>{b.name}</span>
                      <small>{count === 0 ? "No people yet" : `${count} ${count === 1 ? "person" : "people"}`}</small>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    );
  }

  // Step 1: category type
  return (
    <div className="tree-picker-shell" key="tree-home">
      <section className="tree-picker-hero">
        <div className="tree-picker-hero-copy">
          <span className="tree-picker-kicker">A living map of Scripture</span>
          <h2>Follow the generations.<br />See how every name connects.</h2>
          <p>Trace parents, children, and spouses from Adam forward—or narrow the map to one family or one book.</p>
        </div>
        <div className="tree-lineage-preview" aria-label="Example lineage: Adam to Noah to Abraham to David to Jesus">
          {[
            ["Adam", "Beginning"],
            ["Noah", "10th generation"],
            ["Abraham", "Promise"],
            ["David", "Royal line"],
            ["Jesus", "Messiah"],
          ].map(([name, note], index) => (
            <div key={name} className={`tree-lineage-stop${name === "Jesus" ? " final" : ""}`}>
              <span className="tree-lineage-dot">{index + 1}</span>
              <span className="tree-lineage-name"><strong>{name}</strong><small>{note}</small></span>
            </div>
          ))}
        </div>
      </section>

      <div className="tree-entry-grid">
        <button type="button" className="tree-entry-card featured" onClick={() => setStep1("all")}>
          <span className="tree-entry-index">01</span>
          <span className="tree-entry-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 22V12M12 12L6 7M12 12l6-5M6 7V4M18 7V4M6 7h12"/></svg></span>
          <strong>Full family tree</strong>
          <small>Begin with Adam and explore the complete connected map.</small>
          <span className="tree-entry-meta">Start with Adam <b>Open map →</b></span>
        </button>
        <button type="button" className="tree-entry-card" onClick={() => setStep1("families")}>
          <span className="tree-entry-index">02</span>
          <span className="tree-entry-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg></span>
          <strong>Browse families</strong>
          <small>Focus on Abraham, Jacob, David, and other major households.</small>
          <span className="tree-entry-meta">{FAMILIES.length} family groups <b>Choose family →</b></span>
        </button>
        <button type="button" className="tree-entry-card" onClick={() => setStep1("books")}>
          <span className="tree-entry-index">03</span>
          <span className="tree-entry-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg></span>
          <strong>Browse by book</strong>
          <small>See every recorded person from one book in a focused view.</small>
          <span className="tree-entry-meta">{BIBLE_BOOKS.filter(b => (bookCounts.get(b.name) ?? 0) > 0).length} books indexed <b>Choose book →</b></span>
        </button>
      </div>
    </div>
  );
}
