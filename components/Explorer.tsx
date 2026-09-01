"use client";
import { useState, useCallback, useMemo } from "react";
import { usePeople } from "@/hooks/usePeople";
import { useRelationships } from "@/hooks/useRelationships";
import { useRefs } from "@/hooks/useRefs";
import type { Person, Relationship, ScriptureRef, RelationshipType } from "@/lib/types";
import { BIBLE_BOOKS, RELATIONSHIP_LABELS, RELATIONSHIP_INVERSE_LABELS, RELATIONSHIP_COLORS } from "@/lib/types";
import { formatRef } from "@/lib/mappers";
import { TreeCategoryPicker } from "./TreeCategoryPicker";
import { Timeline } from "./Timeline";

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
type Section = "people" | "books" | "tree" | "timeline" | "stats";

const NAV: { key: Section; label: string; icon: string }[] = [
  { key: "people", label: "People",      icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
  { key: "books",  label: "By Book",     icon: "M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" },
  { key: "tree",   label: "Family Tree", icon: "M12 22V12M12 12L6 7M12 12l6-5M6 7V4M18 7V4M6 7h12" },
  { key: "timeline", label: "Timeline",  icon: "M12 8v4l3 2M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0" },
  { key: "stats",  label: "Insights",    icon: "M18 20V10M12 20V4M6 20v-6" },
];

// ── Small helpers ─────────────────────────────────────────────────────────────
function TestamentBadge({ testament }: { testament: Person["testament"] }) {
  const cls = testament === "OT" ? "badge-ot" : testament === "NT" ? "badge-nt" : "badge-both";
  return <span className={`badge ${cls}`}>{testament === "both" ? "OT & NT" : testament}</span>;
}

// ── Add / Edit Person Modal ───────────────────────────────────────────────────
interface PersonModalProps {
  initial?: Person;
  onSave: (p: Omit<Person, "id" | "createdAt">) => Promise<void>;
  onClose: () => void;
}
function PersonModal({ initial, onSave, onClose }: PersonModalProps) {
  const EMPTY = { name: "", alsoKnownAs: "", gender: "unknown" as Person["gender"], testament: "OT" as Person["testament"], birthYear: "", deathYear: "", description: "", tags: [] as string[] };
  const [form, setForm] = useState(initial ? {
    name: initial.name,
    alsoKnownAs: initial.alsoKnownAs,
    gender: initial.gender,
    testament: initial.testament,
    birthYear: initial.birthYear,
    deathYear: initial.deathYear,
    description: initial.description,
    tags: [...initial.tags],
  } : { ...EMPTY });
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const isEdit = !!initial;

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
      // Timeline fields aren't editable in this modal (that's a later task) —
      // preserve them on edit, default to empty/null on create so this stays
      // additive without wiping data a seed script may have written.
      await onSave({
        ...form,
        timelineStartBc: initial?.timelineStartBc ?? null,
        timelineEndBc: initial?.timelineEndBc ?? null,
        timelineTrack: initial?.timelineTrack ?? "",
        dateUncertaintyNote: initial?.dateUncertaintyNote ?? "",
        dateConfidence: initial?.dateConfidence ?? "firm",
      });
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
          <span className="modal-title">{isEdit ? `Edit ${initial!.name}` : "Add Person"}</span>
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
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? "Saving…" : isEdit ? "Save Changes" : "Add Person"}</button>
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
  // Mirrors chapterEnd/verseEnd to chapterStart/verseStart until the user
  // explicitly edits an End field — without this, a quick single-verse entry
  // (only filling "From") silently saves a backwards range since End defaults
  // to 1 regardless of what Start is set to.
  const [endTouched, setEndTouched] = useState(false);
  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const isNumeric = k.includes("chapter") || k.includes("verse");
    const value = isNumeric ? Number(e.target.value) : e.target.value;
    if (k === "chapterEnd" || k === "verseEnd") setEndTouched(true);
    setForm(prev => {
      const next = { ...prev, [k]: value };
      if (!endTouched) {
        if (k === "chapterStart") next.chapterEnd = value as number;
        if (k === "verseStart") next.verseEnd = value as number;
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Always person-owned — event-owned refs are only written by later seed
    // scripts, not this modal.
    await onSave({ ...form, personId, eventId: null });
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
                  {others.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.alsoKnownAs ? `${p.name} — ${p.alsoKnownAs.split(",")[0].trim()}` : p.name}
                    </option>
                  ))}
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
  onEdit: () => void;
  onAddRef: () => void;
  onDeleteRef: (id: string) => void;
  onAddRel: () => void;
  onDeleteRel: (id: string) => void;
  onDelete: () => void;
}
function DetailPane({ person, relationships, refs, people, onNavigate, onClose, onEdit, onAddRef, onDeleteRef, onAddRel, onDeleteRel, onDelete }: DetailPaneProps) {
  const personRels = relationships.filter(r => r.personAId === person.id || r.personBId === person.id);
  const personRefs = refs.filter(r => r.personId === person.id).sort((a, b) => {
    const ba = BIBLE_BOOKS.find(bk => bk.name === a.book)?.order ?? 99;
    const bb = BIBLE_BOOKS.find(bk => bk.name === b.book)?.order ?? 99;
    return ba - bb || a.chapterStart - b.chapterStart || a.verseStart - b.verseStart;
  });

  const childCount    = personRels.filter(r => r.type === "parent_of" && r.personAId === person.id).length;
  const siblingCount  = personRels.filter(r => r.type === "sibling_of").length;
  const spouseCount   = personRels.filter(r => r.type === "spouse_of").length;

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
          {(childCount > 0 || siblingCount > 0 || spouseCount > 0 || personRefs.length > 0) && (
            <div style={{ marginTop: 10, display: "flex", gap: 14, fontSize: 12, color: "var(--text3)" }}>
              {childCount   > 0 && <span><strong style={{ color: "var(--text2)" }}>{childCount}</strong> {childCount === 1 ? "child" : "children"}</span>}
              {spouseCount  > 0 && <span><strong style={{ color: "var(--text2)" }}>{spouseCount}</strong> {spouseCount === 1 ? "spouse" : "spouses"}</span>}
              {siblingCount > 0 && <span><strong style={{ color: "var(--text2)" }}>{siblingCount}</strong> {siblingCount === 1 ? "sibling" : "siblings"}</span>}
              {personRefs.length > 0 && <span><strong style={{ color: "var(--text2)" }}>{personRefs.length}</strong> refs</span>}
            </div>
          )}
        </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button className="btn btn-ghost btn-sm" onClick={onEdit} title="Edit person">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Edit
            </button>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
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
                  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: RELATIONSHIP_COLORS[r.type] ?? RELATIONSHIP_COLORS.other, flexShrink: 0 }} />
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
  onEditPerson: (p: Person) => void;
  onAddRef: (p: Person) => void;
  onDeleteRef: (id: string) => void;
  onAddRel: (p: Person) => void;
  onDeleteRel: (id: string) => void;
  onDeletePerson: (id: string) => void;
}
function PeopleSection({ people, relationships, refs, selectedId, onSelect, onAddPerson, onEditPerson, onAddRef, onDeleteRef, onAddRel, onDeleteRel, onDeletePerson }: PeopleSectionProps) {
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
    <div className={`people-layout${selected ? " detail-open" : ""}`} style={{ display: "flex", flex: 1, overflow: "hidden", height: "100%" }}>
      <div className="people-list-col" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Toolbar */}
        <div className="people-toolbar" style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg2)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div className="search-wrap">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input className="search-input" placeholder="Search people…" value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          <button className="people-toolbar-add btn btn-primary btn-sm" style={{ marginLeft: "auto", flexShrink: 0 }} onClick={onAddPerson}>+ Add Person</button>
          <div className="filter-bar" style={{ flexShrink: 0 }}>
            {(["all", "OT", "NT", "both"] as const).map(f => (
              <button key={f} className={`filter-chip${filter === f ? " active" : ""}`} onClick={() => setFilter(f)}>
                {f === "all" ? "All" : f === "both" ? "OT & NT" : f}
              </button>
            ))}
          </div>
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
          onEdit={() => onEditPerson(selected)}
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
    <div className={`books-layout${activeBook ? " book-open" : ""}`} style={{ display: "flex", gap: 0, flex: 1, overflow: "hidden" }}>
      {/* Book list */}
      <div className="books-list-col" style={{ width: 280, flexShrink: 0, borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", background: "var(--bg2)", display: "flex", gap: 6 }}>
          {(["all", "OT", "NT"] as const).map(t => (
            <button key={t} className={`filter-chip${testament === t ? " active" : ""}`} onClick={() => setTestament(t)}>
              {t === "all" ? "All" : t}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: "12px" }}>
          <div className="book-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            {books.map(b => {
              const count = countByBook(b.name);
              return (
                <div key={b.name} className={`book-tile${activeBook === b.name ? " active" : ""}`}
                  onClick={() => setActiveBook(b.name)}
                  style={count === 0 ? { opacity: 0.35, cursor: "default", pointerEvents: "none" } : undefined}>
                  <div className="book-tile-name">{b.name}</div>
                  <div className="book-tile-count">{count === 0 ? "no people" : `${count} ${count === 1 ? "person" : "people"}`}</div>
                  {b.summary && <div className="book-tile-summary">{b.summary}</div>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* People in book */}
      <div className="books-people-col" style={{ flex: 1, overflow: "auto", padding: "20px" }}>
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
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <button className="mob-only btn btn-ghost btn-sm" onClick={() => setActiveBook(null)} style={{ flexShrink: 0 }}>← Books</button>
              <h2 style={{ fontFamily: "var(--font)", fontSize: 18, fontWeight: 700, color: "var(--text)", margin: 0 }}>{activeBook} — {bookPeople.length} {bookPeople.length === 1 ? "person" : "people"}</h2>
            </div>
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

// ── Stats / Insights Section ──────────────────────────────────────────────────
interface StatsSectionProps {
  people: Person[];
  refs: ScriptureRef[];
  relationships: Relationship[];
  onNavigate: (id: string) => void;
}
function StatsSection({ people, refs, relationships, onNavigate }: StatsSectionProps) {
  const refCountById = useMemo(() => {
    const m = new Map<string, number>();
    refs.forEach(r => m.set(r.personId, (m.get(r.personId) ?? 0) + 1));
    return m;
  }, [refs]);

  const topReferenced = useMemo(() =>
    [...people].sort((a, b) => (refCountById.get(b.id) ?? 0) - (refCountById.get(a.id) ?? 0)).slice(0, 10),
    [people, refCountById],
  );
  const maxRefs = (refCountById.get(topReferenced[0]?.id) ?? 0) || 1;

  const relCountById = useMemo(() => {
    const m = new Map<string, number>();
    relationships.forEach(r => {
      m.set(r.personAId, (m.get(r.personAId) ?? 0) + 1);
      m.set(r.personBId, (m.get(r.personBId) ?? 0) + 1);
    });
    return m;
  }, [relationships]);

  const topConnected = useMemo(() =>
    [...people].sort((a, b) => (relCountById.get(b.id) ?? 0) - (relCountById.get(a.id) ?? 0)).slice(0, 10),
    [people, relCountById],
  );
  const maxRels = (relCountById.get(topConnected[0]?.id) ?? 0) || 1;

  const topBooks = useMemo(() => {
    const m = new Map<string, Set<string>>();
    refs.forEach(r => {
      if (!m.has(r.book)) m.set(r.book, new Set());
      m.get(r.book)!.add(r.personId);
    });
    return [...m.entries()]
      .map(([book, ids]) => ({ book, count: ids.size }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [refs]);
  const maxBookCount = topBooks[0]?.count || 1;

  const typeBreakdown = useMemo(() => {
    const m = new Map<string, number>();
    relationships.forEach(r => m.set(r.type, (m.get(r.type) ?? 0) + 1));
    return [...m.entries()]
      .map(([type, count]) => ({ type, count, label: RELATIONSHIP_LABELS[type as RelationshipType] ?? type, color: RELATIONSHIP_COLORS[type as RelationshipType] ?? RELATIONSHIP_COLORS.other }))
      .sort((a, b) => b.count - a.count);
  }, [relationships]);
  const maxTypeCount = typeBreakdown[0]?.count || 1;

  const otCount   = people.filter(p => p.testament === "OT").length;
  const ntCount   = people.filter(p => p.testament === "NT").length;
  const bothCount = people.filter(p => p.testament === "both").length;

  const statCard = (value: number, label: string) => (
    <div style={{ background: "var(--surface, #fff)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 24px", flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 32, fontWeight: 800, color: "var(--text)", fontFamily: "var(--font, serif)", lineHeight: 1 }}>{value.toLocaleString()}</div>
      <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 6, fontFamily: "var(--ui-font, sans-serif)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
    </div>
  );

  const barList = (
    items: { id?: string; name: string; count: number; color?: string }[],
    max: number,
    onClickItem?: (id: string) => void,
  ) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((item, i) => (
        <div key={item.id ?? item.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 20, fontSize: 11, color: "var(--text3)", textAlign: "right", flexShrink: 0, fontFamily: "var(--mono, monospace)" }}>{i + 1}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
              <span
                style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: item.id && onClickItem ? "pointer" : "default", textDecoration: item.id && onClickItem ? "underline" : "none", textDecorationStyle: "dotted", textUnderlineOffset: "2px" }}
                onClick={() => { if (item.id && onClickItem) onClickItem(item.id); }}
                title={item.id && onClickItem ? `View ${item.name}` : undefined}
              >{item.name}</span>
              <span style={{ fontSize: 11, color: "var(--text3)", flexShrink: 0, marginLeft: "auto", paddingLeft: 8 }}>{item.count}</span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: "var(--bg3, #ece7db)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(item.count / max) * 100}%`, background: item.color ?? "var(--primary, #4a3d1e)", borderRadius: 3 }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "clamp(14px, 4vw, 28px)" }}>
      {/* Summary cards */}
      <div className="stats-summary-cards" style={{ display: "flex", gap: 14, marginBottom: 28, flexWrap: "wrap" }}>
        {statCard(people.length, "People")}
        {statCard(refs.length, "Scripture refs")}
        {statCard(relationships.length, "Relationships")}
        {statCard(topBooks.length, "Books covered")}
      </div>

      {/* Testament split */}
      <div style={{ marginBottom: 28, background: "var(--surface, #fff)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 22px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text3)", marginBottom: 12 }}>Testament Breakdown</div>
        <div style={{ display: "flex", gap: 0, height: 20, borderRadius: 6, overflow: "hidden", marginBottom: 10 }}>
          <div style={{ width: `${(otCount / people.length) * 100}%`, background: "#b45309" }} title={`OT: ${otCount}`} />
          <div style={{ width: `${(bothCount / people.length) * 100}%`, background: "#4f46e5" }} title={`Both: ${bothCount}`} />
          <div style={{ width: `${(ntCount / people.length) * 100}%`, background: "#0f766e" }} title={`NT: ${ntCount}`} />
        </div>
        <div style={{ display: "flex", gap: 20, fontSize: 12 }}>
          {[
            { label: "Old Testament", count: otCount, color: "#b45309" },
            { label: "Both", count: bothCount, color: "#4f46e5" },
            { label: "New Testament", count: ntCount, color: "#0f766e" },
          ].map(({ label, count, color }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0, display: "inline-block" }} />
              <span style={{ color: "var(--text2)" }}><strong>{count}</strong> {label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Two-column charts */}
      <div className="stats-charts-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <div style={{ background: "var(--surface, #fff)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 22px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text3)", marginBottom: 14 }}>Most Referenced</div>
          {barList(topReferenced.map(p => ({ id: p.id, name: p.name, count: refCountById.get(p.id) ?? 0 })), maxRefs, onNavigate)}
        </div>
        <div style={{ background: "var(--surface, #fff)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 22px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text3)", marginBottom: 14 }}>Most Connected</div>
          {barList(topConnected.map(p => ({ id: p.id, name: p.name, count: relCountById.get(p.id) ?? 0 })), maxRels, onNavigate)}
        </div>
      </div>

      <div className="stats-charts-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ background: "var(--surface, #fff)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 22px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text3)", marginBottom: 14 }}>Books by People</div>
          {barList(topBooks.map(({ book, count }) => ({ name: book, count })), maxBookCount)}
        </div>
        <div style={{ background: "var(--surface, #fff)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 22px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text3)", marginBottom: 14 }}>Relationship Types</div>
          {barList(typeBreakdown.map(({ label, count, color }) => ({ name: label, count, color })), maxTypeCount)}
        </div>
      </div>
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
  const [editPersonFor, setEditPersonFor] = useState<Person | null>(null);
  const [addRefFor, setAddRefFor] = useState<Person | null>(null);
  const [addRelFor, setAddRelFor] = useState<Person | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Desktop counterpart to sidebarOpen. The single menu button toggles both:
  // on mobile only `open` has any effect (the collapse rule is scoped above
  // the breakpoint), on desktop only `nav-collapsed` does. Both start false,
  // which is closed-drawer on mobile and expanded on desktop — correct for
  // each — and they stay in step from there.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const toggleSidebar = () => { setSidebarOpen(o => !o); setSidebarCollapsed(c => !c); };

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
        <nav className={`app-sidebar${sidebarOpen ? " open" : ""}${sidebarCollapsed ? " nav-collapsed" : ""}`} id="app-sidebar">
          <div className="sidebar-logo">
            <img src="/logo-birdseye.png" alt="" className="sidebar-logo-icon" />
            <span>Birds<span className="logo-eye">eye</span></span>
          </div>
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
            <button className="mob-menu-btn" aria-label="Toggle navigation" onClick={toggleSidebar}>
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
              onEditPerson={p => setEditPersonFor(p)}
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
            <button className="mob-menu-btn" aria-label="Toggle navigation" onClick={toggleSidebar}>
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
            <button className="mob-menu-btn" aria-label="Toggle navigation" onClick={toggleSidebar}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <div>
              <div className="section-eyebrow">Explore</div>
              <div className="section-title">Family Tree</div>
              <div className="section-subtitle">Pick a family or book to explore, or view the full tree</div>
            </div>
          </div>
          <TreeCategoryPicker people={people} relationships={relationships} refs={refs} onSelect={selectPerson} />
        </div>

        {/* Timeline section */}
        <div className={`app-section${section === "timeline" ? " active" : ""}`}>
          <div className="section-header">
            <button className="mob-menu-btn" aria-label="Toggle navigation" onClick={toggleSidebar}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <div>
              <div className="section-eyebrow">Explore</div>
              <div className="section-title">Timeline</div>
              <div className="section-subtitle">Scroll from the judges through exile and return</div>
            </div>
          </div>
          <Timeline onSelectPerson={selectPerson} />
        </div>

        {/* Stats section */}
        <div className={`app-section${section === "stats" ? " active" : ""}`}>
          <div className="section-header">
            <button className="mob-menu-btn" aria-label="Toggle navigation" onClick={toggleSidebar}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <div>
              <div className="section-eyebrow">Explore</div>
              <div className="section-title">Insights</div>
              <div className="section-subtitle">Most referenced, most connected, coverage by book</div>
            </div>
          </div>
          <StatsSection people={people} refs={refs} relationships={relationships} onNavigate={selectPerson} />
        </div>
      </div>

      {/* Toast container */}
      <div id="toast-wrap" className="toast-wrap" />

      {/* Modals */}
      {showAddPerson && (
        <PersonModal
          onSave={async p => { await addPerson(p); showToast(`${p.name} added`); }}
          onClose={() => setShowAddPerson(false)}
        />
      )}
      {editPersonFor && (
        <PersonModal
          initial={editPersonFor}
          onSave={async p => { await updatePerson(editPersonFor.id, p); showToast(`${p.name} updated`); }}
          onClose={() => setEditPersonFor(null)}
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
