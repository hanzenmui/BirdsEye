"use client";
import { useState, useCallback } from "react";
import { usePeople } from "@/hooks/usePeople";
import { useRelationships } from "@/hooks/useRelationships";
import { useRefs } from "@/hooks/useRefs";
import type { Person, Relationship, ScriptureRef, RelationshipType } from "@/lib/types";
import { BIBLE_BOOKS, RELATIONSHIP_LABELS, RELATIONSHIP_INVERSE_LABELS } from "@/lib/types";
import { FamilyTree } from "./FamilyTree";

// Returns the relationship label from the given person's perspective.
// When the person is person_a they are the actor; when person_b they are the target.
function relLabel(r: Relationship, personId: string): string {
  const isA = r.personAId === personId;
  return isA ? (RELATIONSHIP_LABELS[r.type] ?? r.type) : (RELATIONSHIP_INVERSE_LABELS[r.type] ?? RELATIONSHIP_LABELS[r.type] ?? r.type);
}

// ── Toast ────────────────────────────────────────────────────────────────────
let _toastTimer: ReturnType<typeof setTimeout> | null = null;
function showToast(msg: string, type: "success" | "error" = "success") {
  const wrap = document.getElementById("toast-wrap");
  if (!wrap) return;
  const el = document.createElement("div");
  el.className = `toast${type === "error" ? " error" : ""}`;
  el.textContent = msg;
  wrap.appendChild(el);
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { if (wrap.contains(el)) wrap.removeChild(el); }, 3000);
}

// ── Card art colors (cycling) ────────────────────────────────────────────────
const CARD_COLORS = ['#1F5450', '#ABD3C8', '#CF6B4F', '#2E7167', '#70566D'];

// ── Sidebar nav sections ─────────────────────────────────────────────────────
type Section = "people" | "books" | "tree";

const NAV: { key: Section; label: string; icon: string }[] = [
  { key: "people", label: "People", icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
  { key: "books",  label: "By Book", icon: "M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" },
  { key: "tree",   label: "Family Tree", icon: "M12 22V12M12 12L6 7M12 12l6-5M6 7V4M18 7V4M6 7h12" },
];

// ── Small helpers ─────────────────────────────────────────────────────────────
function TestamentBadge({ testament }: { testament: Person["testament"] }) {
  const cls = testament === "OT" ? "badge-ot" : testament === "NT" ? "badge-nt" : "badge-both";
  return <span className={`badge ${cls}`}>{testament === "both" ? "OT & NT" : testament}</span>;
}

function formatRef(r: ScriptureRef) {
  const same = r.chapterStart === r.chapterEnd;
  if (same && r.verseStart === r.verseEnd) return `${r.book} ${r.chapterStart}:${r.verseStart}`;
  if (same) return `${r.book} ${r.chapterStart}:${r.verseStart}–${r.verseEnd}`;
  return `${r.book} ${r.chapterStart}:${r.verseStart} – ${r.chapterEnd}:${r.verseEnd}`;
}

// ── Add Person Modal ──────────────────────────────────────────────────────────
interface AddPersonProps {
  onSave: (p: Omit<Person, "id" | "createdAt">) => Promise<void>;
  onClose: () => void;
}
function AddPersonModal({ onSave, onClose }: AddPersonProps) {
  const EMPTY = { name: "", alsoKnownAs: "", gender: "unknown" as Person["gender"], testament: "OT" as Person["testament"], birthYear: "", deathYear: "", description: "", tags: [] as string[] };
  const [form, setForm] = useState({ ...EMPTY });
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !form.tags.includes(t)) setForm(p => ({ ...p, tags: [...p.tags, t] }));
    setTagInput("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch {
      // onSave threw — stay open so the user can retry
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Add Person</span>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="form-group full">
                <label className="form-label">Name *</label>
                <input className="form-input" value={form.name} onChange={f("name")} autoFocus placeholder="e.g. Moses" />
              </div>
              <div className="form-group full">
                <label className="form-label">Also Known As</label>
                <input className="form-input" value={form.alsoKnownAs} onChange={f("alsoKnownAs")} placeholder="Comma-separated aliases" />
              </div>
              <div className="form-group">
                <label className="form-label">Gender</label>
                <select className="form-input" value={form.gender} onChange={f("gender")}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Testament</label>
                <select className="form-input" value={form.testament} onChange={f("testament")}>
                  <option value="OT">Old Testament</option>
                  <option value="NT">New Testament</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Birth Year</label>
                <input className="form-input" value={form.birthYear} onChange={f("birthYear")} placeholder="e.g. c. 1526 BC" />
              </div>
              <div className="form-group">
                <label className="form-label">Death Year</label>
                <input className="form-input" value={form.deathYear} onChange={f("deathYear")} placeholder="e.g. c. 1406 BC" />
              </div>
              <div className="form-group full">
                <label className="form-label">Description</label>
                <textarea className="form-input" value={form.description} onChange={f("description")} placeholder="Brief summary of who this person is…" />
              </div>
              <div className="form-group full">
                <label className="form-label">Tags</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <input className="form-input" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} placeholder="prophet, king, judge…" style={{ flex: 1 }} />
                  <button type="button" className="btn btn-ghost btn-sm" onClick={addTag}>Add</button>
                </div>
                {form.tags.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                    {form.tags.map(t => (
                      <span key={t} className="badge badge-tag" style={{ cursor: "pointer" }} onClick={() => setForm(p => ({ ...p, tags: p.tags.filter(x => x !== t) }))}>
                        {t} ×
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? "Saving…" : "Add Person"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Add Ref Modal ─────────────────────────────────────────────────────────────
interface AddRefProps {
  personId: string;
  onSave: (r: Omit<ScriptureRef, "id" | "createdAt">) => Promise<void>;
  onClose: () => void;
}
function AddRefModal({ personId, onSave, onClose }: AddRefProps) {
  const [form, setForm] = useState({ book: "Genesis", chapterStart: 1, verseStart: 1, chapterEnd: 1, verseEnd: 1, note: "" });
  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: k.includes("chapter") || k.includes("verse") ? Number(e.target.value) : e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({ ...form, personId });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Add Scripture Reference</span>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="form-group full">
                <label className="form-label">Book</label>
                <select className="form-input" value={form.book} onChange={f("book")}>
                  {BIBLE_BOOKS.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">From Chapter : Verse</label>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input className="form-input" type="number" min={1} value={form.chapterStart} onChange={f("chapterStart")} style={{ width: 70 }} />
                  <span style={{ color: "var(--text3)" }}>:</span>
                  <input className="form-input" type="number" min={1} value={form.verseStart} onChange={f("verseStart")} style={{ width: 70 }} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">To Chapter : Verse</label>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input className="form-input" type="number" min={1} value={form.chapterEnd} onChange={f("chapterEnd")} style={{ width: 70 }} />
                  <span style={{ color: "var(--text3)" }}>:</span>
                  <input className="form-input" type="number" min={1} value={form.verseEnd} onChange={f("verseEnd")} style={{ width: 70 }} />
                </div>
              </div>
              <div className="form-group full">
                <label className="form-label">Context Note</label>
                <input className="form-input" value={form.note} onChange={f("note")} placeholder="e.g. Birth of Moses described" />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm">Add Reference</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Add Relationship Modal ────────────────────────────────────────────────────
interface AddRelProps {
  focalPerson: Person;
  people: Person[];
  onSave: (r: Omit<Relationship, "id" | "createdAt">) => Promise<void>;
  onClose: () => void;
}
const INVERSE_TYPES: Partial<Record<RelationshipType, RelationshipType>> = {
  child_of:      "parent_of",
  descendant_of: "ancestor_of",
  disciple_of:   "mentor_of",
};

function AddRelModal({ focalPerson, people, onSave, onClose }: AddRelProps) {
  const [type, setType] = useState<RelationshipType>("parent_of");
  const [personBId, setPersonBId] = useState("");
  const [notes, setNotes] = useState("");

  const others = people.filter(p => p.id !== focalPerson.id);
  const personB = people.find(p => p.id === personBId);
  const typeLabel = RELATIONSHIP_LABELS[type].toLowerCase();
  const preview = personB
    ? `${focalPerson.name} is ${typeLabel} ${personB.name}`
    : `${focalPerson.name} is ${typeLabel} …`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personBId || !personB) return;
    const flip = type in INVERSE_TYPES;
    const canonicalType = INVERSE_TYPES[type] ?? type;
    await onSave({
      personAId:   flip ? personBId        : focalPerson.id,
      personAName: flip ? personB.name     : focalPerson.name,
      type:        canonicalType,
      personBId:   flip ? focalPerson.id   : personBId,
      personBName: flip ? focalPerson.name : personB.name,
      notes,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Add Relationship</span>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="form-group full" style={{ background: "var(--bg3)", borderRadius: "var(--radius)", padding: "10px 12px" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{preview}</span>
              </div>
              <div className="form-group">
                <label className="form-label">Relationship Type</label>
                <select className="form-input" value={type} onChange={e => setType(e.target.value as RelationshipType)}>
                  {(Object.entries(RELATIONSHIP_LABELS) as [RelationshipType, string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">The Other Person</label>
                <select className="form-input" value={personBId} onChange={e => setPersonBId(e.target.value)} required>
                  <option value="">— Select person —</option>
                  {others.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-group full">
                <label className="form-label">Notes</label>
                <input className="form-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional context…" />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={!personBId}>Add Relationship</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Detail Pane ───────────────────────────────────────────────────────────────
interface DetailPaneProps {
  person: Person;
  relationships: Relationship[];
  refs: ScriptureRef[];
  people: Person[];
  onNavigate: (id: string) => void;
  onClose: () => void;
  onAddRef: () => void;
  onDeleteRef: (id: string) => void;
  onAddRel: () => void;
  onDeleteRel: (id: string) => void;
  onDelete: () => void;
}
function DetailPane({ person, relationships, refs, people, onNavigate, onClose, onAddRef, onDeleteRef, onAddRel, onDeleteRel, onDelete }: DetailPaneProps) {
  const personRels = relationships.filter(r => r.personAId === person.id || r.personBId === person.id);
  const personRefs = refs.filter(r => r.personId === person.id).sort((a, b) => {
    const ba = BIBLE_BOOKS.find(bk => bk.name === a.book)?.order ?? 99;
    const bb = BIBLE_BOOKS.find(bk => bk.name === b.book)?.order ?? 99;
    return ba - bb || a.chapterStart - b.chapterStart || a.verseStart - b.verseStart;
  });

  return (
    <div className="detail-pane">
      <div className="detail-pane-header">
        <div>
          <div className="detail-pane-name">{person.name}</div>
          {person.alsoKnownAs && <div className="detail-pane-aka">Also: {person.alsoKnownAs}</div>}
          <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <TestamentBadge testament={person.testament} />
            {person.gender !== "unknown" && <span className="badge badge-tag">{person.gender}</span>}
            {person.tags.map(t => <span key={t} className="badge badge-tag">{t}</span>)}
          </div>
        </div>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      <div className="detail-pane-body">
        {/* Dates */}
        {(person.birthYear || person.deathYear) && (
          <div style={{ display: "flex", gap: 16 }}>
            {person.birthYear && <div><div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text3)", marginBottom: 2 }}>Born</div><div style={{ fontSize: 13, color: "var(--text2)" }}>{person.birthYear}</div></div>}
            {person.deathYear && <div><div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text3)", marginBottom: 2 }}>Died</div><div style={{ fontSize: 13, color: "var(--text2)" }}>{person.deathYear}</div></div>}
          </div>
        )}

        {/* Description */}
        {person.description && (
          <div>
            <div className="detail-section-title">About</div>
            <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.65, fontFamily: "var(--font)" }}>{person.description}</p>
          </div>
        )}

        {/* Relationships */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div className="detail-section-title" style={{ marginBottom: 0 }}>Relationships</div>
            <button className="btn btn-ghost btn-sm" onClick={onAddRel}>+ Add</button>
          </div>
          {personRels.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text3)", fontStyle: "italic" }}>No relationships recorded.</div>
          ) : (
            personRels.map(r => {
              const isA = r.personAId === person.id;
              const otherName = isA ? r.personBName : r.personAName;
              const otherId   = isA ? r.personBId   : r.personAId;
              const label = relLabel(r, person.id);
              return (
                <div key={r.id} className="rel-item">
                  <span className="rel-type-label">{label}</span>
                  <span className="rel-person-name" onClick={() => onNavigate(otherId)}>{otherName}</span>
                  {r.notes && <span style={{ fontSize: 11, color: "var(--text3)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.notes}</span>}
                  <button className="btn btn-icon btn-ghost btn-sm" onClick={() => onDeleteRel(r.id)} title="Remove" style={{ marginLeft: "auto", flexShrink: 0, color: "var(--danger)" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Scripture refs */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div className="detail-section-title" style={{ marginBottom: 0 }}>Scripture References ({personRefs.length})</div>
            <button className="btn btn-ghost btn-sm" onClick={onAddRef}>+ Add</button>
          </div>
          {personRefs.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text3)", fontStyle: "italic" }}>No references recorded.</div>
          ) : (
            personRefs.map(r => (
              <div key={r.id} className="ref-item" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                <div>
                  <div className="ref-location">{formatRef(r)}</div>
                  {r.note && <div className="ref-note">{r.note}</div>}
                </div>
                <button className="btn btn-icon btn-ghost btn-sm" onClick={() => onDeleteRef(r.id)} title="Remove" style={{ flexShrink: 0, color: "var(--danger)" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Danger zone */}
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <button className="btn btn-danger btn-sm" onClick={onDelete}>Delete {person.name}</button>
        </div>
      </div>
    </div>
  );
}

// ── People Section ────────────────────────────────────────────────────────────
interface PeopleSectionProps {
  people: Person[];
  relationships: Relationship[];
  refs: ScriptureRef[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddPerson: () => void;
  onAddRef: (p: Person) => void;
  onDeleteRef: (id: string) => void;
  onAddRel: (p: Person) => void;
  onDeleteRel: (id: string) => void;
  onDeletePerson: (id: string) => void;
}
function PeopleSection({ people, relationships, refs, selectedId, onSelect, onAddPerson, onAddRef, onDeleteRef, onAddRel, onDeleteRel, onDeletePerson }: PeopleSectionProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "OT" | "NT" | "both">("all");

  const filtered = people.filter(p => {
    if (filter !== "all" && p.testament !== filter) return false;
    if (query) {
      const q = query.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.alsoKnownAs.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.tags.some(t => t.includes(q));
    }
    return true;
  });

  const selected = selectedId ? people.find(p => p.id === selectedId) ?? null : null;

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden", height: "100%" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Toolbar */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg2)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div className="search-wrap">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input className="search-input" placeholder="Search people…" value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          <div className="filter-bar" style={{ flexShrink: 0 }}>
            {(["all", "OT", "NT", "both"] as const).map(f => (
              <button key={f} className={`filter-chip${filter === f ? " active" : ""}`} onClick={() => setFilter(f)}>
                {f === "all" ? "All" : f === "both" ? "OT & NT" : f}
              </button>
            ))}
          </div>
          <button className="btn btn-primary btn-sm" style={{ marginLeft: "auto", flexShrink: 0 }} onClick={onAddPerson}>+ Add Person</button>
        </div>

        {/* Grid */}
        <div style={{ flex: 1, overflow: "auto", padding: "20px 16px" }}>
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">✦</div>
              <div className="empty-state-title">{query ? "No results" : "No people yet"}</div>
              <div className="empty-state-sub">{query ? "Try a different search." : "Add your first person to get started."}</div>
            </div>
          ) : (
            <div className="people-grid">
              {filtered.map((p, i) => (
                <div key={p.id} className={`person-card${selectedId === p.id ? " selected" : ""}`} onClick={() => onSelect(p.id)}>
                  <div className="person-card-art" style={{ background: CARD_COLORS[i % CARD_COLORS.length] }}>
                    <span className="person-card-initial" style={{ color: i % CARD_COLORS.length === 1 ? 'rgba(36,52,56,0.34)' : 'rgba(241,235,218,0.94)' }}>
                      {p.name[0]}
                    </span>
                  </div>
                  <div className="person-card-body">
                    <div className="person-card-name">{p.name}</div>
                    {p.alsoKnownAs && <div className="person-card-aka">{p.alsoKnownAs}</div>}
                    {p.description && <div className="person-card-desc">{p.description}</div>}
                    <div className="person-card-footer">
                      <TestamentBadge testament={p.testament} />
                      {p.tags.slice(0, 2).map(t => <span key={t} className="badge badge-tag">{t}</span>)}
                      <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text3)", fontFamily: "var(--mono)" }}>
                        {refs.filter(r => r.personId === p.id).length} refs
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail pane */}
      {selected && (
        <DetailPane
          person={selected}
          relationships={relationships}
          refs={refs}
          people={people}
          onNavigate={onSelect}
          onClose={() => onSelect(selected.id)}
          onAddRef={() => onAddRef(selected)}
          onDeleteRef={onDeleteRef}
          onAddRel={() => onAddRel(selected)}
          onDeleteRel={onDeleteRel}
          onDelete={() => { onDeletePerson(selected.id); onSelect(selected.id); }}
        />
      )}
    </div>
  );
}

// ── Books Section ─────────────────────────────────────────────────────────────
interface BooksSectionProps {
  people: Person[];
  refs: ScriptureRef[];
  onSelect: (id: string) => void;
}
function BooksSection({ people, refs, onSelect }: BooksSectionProps) {
  const [activeBook, setActiveBook] = useState<string | null>(null);
  const [testament, setTestament] = useState<"all" | "OT" | "NT">("all");

  const countByBook = (book: string) => new Set(refs.filter(r => r.book === book).map(r => r.personId)).size;

  const books = BIBLE_BOOKS.filter(b => testament === "all" || b.testament === testament);
  const bookPeople = activeBook
    ? [...new Set(refs.filter(r => r.book === activeBook).map(r => r.personId))]
        .map(id => people.find(p => p.id === id))
        .filter(Boolean) as Person[]
    : [];

  return (
    <div style={{ display: "flex", gap: 0, flex: 1, overflow: "hidden" }}>
      {/* Book list */}
      <div style={{ width: 280, flexShrink: 0, borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", background: "var(--bg2)", display: "flex", gap: 6 }}>
          {(["all", "OT", "NT"] as const).map(t => (
            <button key={t} className={`filter-chip${testament === t ? " active" : ""}`} onClick={() => setTestament(t)}>
              {t === "all" ? "All" : t}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: "12px" }}>
          <div className="book-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            {books.map(b => (
              <div key={b.name} className={`book-tile${activeBook === b.name ? " active" : ""}`} onClick={() => setActiveBook(b.name)}>
                <div className="book-tile-name">{b.name}</div>
                <div className="book-tile-count">{countByBook(b.name)} people</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* People in book */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px" }}>
        {!activeBook ? (
          <div className="empty-state">
            <div className="empty-state-icon">📖</div>
            <div className="empty-state-title">Select a book</div>
            <div className="empty-state-sub">Choose a book to see which people appear in it.</div>
          </div>
        ) : bookPeople.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">✦</div>
            <div className="empty-state-title">No people recorded in {activeBook}</div>
            <div className="empty-state-sub">Add scripture references to people to see them here.</div>
          </div>
        ) : (
          <>
            <h2 style={{ fontFamily: "var(--font)", fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>{activeBook} — {bookPeople.length} {bookPeople.length === 1 ? "person" : "people"}</h2>
            <div className="people-grid">
              {bookPeople.map((p, i) => (
                <div key={p.id} className="person-card" onClick={() => onSelect(p.id)}>
                  <div className="person-card-art" style={{ background: CARD_COLORS[i % CARD_COLORS.length] }}>
                    <span className="person-card-initial" style={{ color: i % CARD_COLORS.length === 1 ? 'rgba(36,52,56,0.34)' : 'rgba(241,235,218,0.94)' }}>
                      {p.name[0]}
                    </span>
                  </div>
                  <div className="person-card-body">
                    <div className="person-card-name">{p.name}</div>
                    {p.description && <div className="person-card-desc">{p.description}</div>}
                    <div className="person-card-footer">
                      <TestamentBadge testament={p.testament} />
                      {refs.filter(r => r.personId === p.id && r.book === activeBook).map(r => (
                        <span key={r.id} className="badge badge-tag" style={{ fontFamily: "var(--mono)", fontSize: 10 }}>{formatRef(r)}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Family Tree Section ───────────────────────────────────────────────────────
interface TreeSectionProps {
  people: Person[];
  relationships: Relationship[];
  onSelect: (id: string) => void;
}
function TreeSection({ people, relationships, onSelect }: TreeSectionProps) {
  const [focalId, setFocalId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const focal = focalId ? people.find(p => p.id === focalId) ?? null : null;

  const rels = focalId
    ? relationships.filter(r => r.personAId === focalId || r.personBId === focalId)
    : [];

  const grouped = rels.reduce<Record<string, { rel: Relationship; otherId: string; otherName: string }[]>>((acc, r) => {
    const isA = r.personAId === focalId;
    const label = relLabel(r, focalId!);
    const otherId   = isA ? r.personBId   : r.personAId;
    const otherName = isA ? r.personBName : r.personAName;
    if (!acc[label]) acc[label] = [];
    acc[label].push({ rel: r, otherId, otherName });
    return acc;
  }, {});

  const suggestions = query
    ? people.filter(p => p.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : [];

  return (
    <div style={{ padding: "24px", overflow: "auto", flex: 1 }}>
      {/* Person selector */}
      <div style={{ maxWidth: 400, marginBottom: 28, position: "relative" }}>
        <label className="form-label">Focus on a person</label>
        <div className="search-wrap" style={{ maxWidth: "100%" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input className="search-input" placeholder="Search by name…" value={query || focal?.name || ""} onChange={e => { setQuery(e.target.value); if (!e.target.value) setFocalId(null); }} />
        </div>
        {suggestions.length > 0 && (
          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "0 4px 16px rgba(0,0,0,0.10)", zIndex: 10, marginTop: 2 }}>
            {suggestions.map(p => (
              <div key={p.id} style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, color: "var(--text)" }}
                onMouseDown={() => { setFocalId(p.id); setQuery(""); }}
              >{p.name}</div>
            ))}
          </div>
        )}
      </div>

      {/* Tree display */}
      {!focal ? (
        <div className="empty-state">
          <div className="empty-state-icon">🌿</div>
          <div className="empty-state-title">Search for a person above</div>
          <div className="empty-state-sub">Their relationships and connections will be mapped here.</div>
        </div>
      ) : (
        <div>
          {/* Focal node */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 32 }}>
            <div className="tree-node focal" style={{ fontSize: 15, padding: "10px 20px" }}>{focal.name}</div>
            <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
              <TestamentBadge testament={focal.testament} />
              {focal.tags.slice(0, 2).map(t => <span key={t} className="badge badge-tag">{t}</span>)}
            </div>
          </div>

          {rels.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-sub">No relationships recorded for {focal.name}.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {Object.entries(grouped).map(([label, items]) => (
                <div key={label}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text3)", marginBottom: 10, fontFamily: "var(--ui-font)" }}>{label}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {items.map(({ rel, otherId, otherName }) => (
                      <div key={rel.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <div className="tree-node" onClick={() => { setFocalId(otherId); setQuery(""); }}>{otherName}</div>
                        {rel.notes && <div style={{ fontSize: 10, color: "var(--text3)", maxWidth: 120, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rel.notes}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 24 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => onSelect(focal.id)}>View full profile →</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Explorer (main orchestrator) ──────────────────────────────────────────────
export function Explorer() {
  const { people, loading: loadingPeople, addPerson, updatePerson, deletePerson } = usePeople();
  const { relationships, addRelationship, deleteRelationship } = useRelationships();
  const { refs, addRef, deleteRef } = useRefs();

  const [section, setSection] = useState<Section>("people");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [addRefFor, setAddRefFor] = useState<Person | null>(null);
  const [addRelFor, setAddRelFor] = useState<Person | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const selectPerson = useCallback((id: string) => {
    setSelectedId(prev => prev === id ? null : id);
    setSection("people");
  }, []);

  const handleDeletePerson = useCallback(async (id: string) => {
    if (!confirm("Delete this person and all their relationships and references?")) return;
    await deletePerson(id);
    setSelectedId(null);
    showToast("Person deleted");
  }, [deletePerson]);

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <>
      <div id="layout-root">
        {/* Sidebar */}
        <nav className={`app-sidebar${sidebarOpen ? " open" : ""}`} id="app-sidebar">
          <div className="sidebar-logo">Birds<span className="logo-eye">eye</span></div>
          <div className="sidebar-nav">
            {NAV.map(n => (
              <div key={n.key} className={`sidebar-item${section === n.key ? " active" : ""}`}
                onClick={() => { setSection(n.key); closeSidebar(); }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={n.icon} />
                </svg>
                <span className="sidebar-item-label">{n.label}</span>
                {n.key === "people" && <span className="sidebar-badge">{people.length}</span>}
              </div>
            ))}
          </div>
          <div className="sidebar-footer">
            <div className="sidebar-footer-label">Birdseye — Bible Explorer</div>
          </div>
        </nav>

        {/* Backdrop */}
        {sidebarOpen && <div className="sidebar-backdrop open" onClick={closeSidebar} />}

        {/* People section */}
        <div className={`app-section${section === "people" ? " active" : ""}`}>
          <div className="section-header">
            <button className="mob-menu-btn" onClick={() => setSidebarOpen(o => !o)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <div>
              <div className="section-eyebrow">Browse</div>
              <div className="section-title">People</div>
              <div className="section-subtitle">{people.length} {people.length === 1 ? "person" : "people"} in the database</div>
            </div>
          </div>
          {loadingPeople ? (
            <div className="loading-wrap"><div className="spinner" /></div>
          ) : (
            <PeopleSection
              people={people}
              relationships={relationships}
              refs={refs}
              selectedId={selectedId}
              onSelect={selectPerson}
              onAddPerson={() => setShowAddPerson(true)}
              onAddRef={p => setAddRefFor(p)}
              onDeleteRef={async id => { await deleteRef(id); showToast("Reference removed"); }}
              onAddRel={p => setAddRelFor(p)}
              onDeleteRel={async id => { await deleteRelationship(id); showToast("Relationship removed"); }}
              onDeletePerson={handleDeletePerson}
            />
          )}
        </div>

        {/* Books section */}
        <div className={`app-section${section === "books" ? " active" : ""}`}>
          <div className="section-header">
            <button className="mob-menu-btn" onClick={() => setSidebarOpen(o => !o)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <div>
              <div className="section-eyebrow">Browse</div>
              <div className="section-title">By Book</div>
              <div className="section-subtitle">Find people by where they appear in scripture</div>
            </div>
          </div>
          <BooksSection people={people} refs={refs} onSelect={id => { selectPerson(id); }} />
        </div>

        {/* Tree section */}
        <div className={`app-section${section === "tree" ? " active" : ""}`}>
          <div className="section-header">
            <button className="mob-menu-btn" onClick={() => setSidebarOpen(o => !o)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <div>
              <div className="section-eyebrow">Explore</div>
              <div className="section-title">Family Tree</div>
              <div className="section-subtitle">Click a node to view profile · double-click to re-root the tree</div>
            </div>
          </div>
          <FamilyTree people={people} relationships={relationships} onSelect={selectPerson} />
        </div>
      </div>

      {/* Toast container */}
      <div id="toast-wrap" className="toast-wrap" />

      {/* Modals */}
      {showAddPerson && (
        <AddPersonModal
          onSave={async p => { await addPerson(p); showToast(`${p.name} added`); }}
          onClose={() => setShowAddPerson(false)}
        />
      )}
      {addRefFor && (
        <AddRefModal
          personId={addRefFor.id}
          onSave={async r => { await addRef(r); showToast("Reference added"); }}
          onClose={() => setAddRefFor(null)}
        />
      )}
      {addRelFor && (
        <AddRelModal
          focalPerson={addRelFor}
          people={people}
          onSave={async r => { await addRelationship(r); showToast("Relationship added"); }}
          onClose={() => setAddRelFor(null)}
        />
      )}
    </>
  );
}
