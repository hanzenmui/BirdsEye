"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { navigate } from "@/hooks/useQueryState";
import { chapterStudy } from "@/lib/chapter-study";
import { bibleGatewayUrl, formatRef } from "@/lib/mappers";
import { BOOK_COVERAGE, RELATIONSHIP_LABELS, type Person, type Relationship, type ScriptureRef, type HistoricalEvent } from "@/lib/types";
import { formatYear, formatYearSpan } from "@/lib/timeline-layout";
import { requestEventFocus } from "@/lib/nav-bus";
import { buildForest } from "./FamilyTree";

type Props = { book: string; chapter: number; people: Person[]; relationships: Relationship[]; refs: ScriptureRef[]; onSelect: (id: string) => void };
type EventData = { events: HistoricalEvent[]; refs: ScriptureRef[] };

export function ChapterStudy({ book, chapter, people, relationships, refs, onSelect }: Props) {
  const study = useMemo(() => chapterStudy(people, relationships, refs, book, chapter), [people, relationships, refs, book, chapter]);
  const forest = useMemo(() => buildForest(people, relationships.map(r => r.type === "child_of"
    ? { ...r, type: "parent_of", personAId: r.personBId, personBId: r.personAId } : r), study.previewIds), [people, relationships, study.previewIds]);
  const byId = useMemo(() => new Map(people.map(p => [p.id, p])), [people]);
  const mapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = mapRef.current;
    if (!container) return;
    const center = () => {
      const focal = forest.all.find(n => study.directIds.has(n.id) && n.children.length > 0) ?? forest.all[0];
      if (focal) container.scrollLeft = Math.max(0, focal.x - container.clientWidth / 2);
    };
    center();
    const observer = new ResizeObserver(center);
    observer.observe(container);
    return () => observer.disconnect();
  }, [forest, study.directIds]);
  const [history, setHistory] = useState<EventData>({ events: [], refs: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/study?book=${encodeURIComponent(book)}&chapter=${chapter}`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!controller.signal.aborted) setHistory(data);
      }).catch(() => { if (!controller.signal.aborted) setError("Could not load passage history."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [book, chapter, retry]);
  const coverage = BOOK_COVERAGE[book];
  const openMap = () => navigate({ section: "tree", treeCategory: "books", treeBook: book, treeChapter: String(chapter), family: null, treePerson: null, treeFilter: null });
  const previewNodes = new Map(forest.all.map(n => [n.id, n]));
  const previewFamily = study.family.filter(r => previewNodes.has(r.personAId) && previewNodes.has(r.personBId));

  return <section className="chapter-study" aria-label={`Study connections for ${book} ${chapter}`}>
    <header className="chapter-study-heading"><h3>See the connections</h3><p>Who belongs together, and where this passage fits.</p></header>
    <div className="chapter-study-columns">
      <section className="chapter-family" aria-labelledby="chapter-family-title">
        <div className="chapter-panel-heading"><h4 id="chapter-family-title">Family in this passage</h4><button className="btn btn-ghost btn-sm" onClick={openMap}>Open passage map</button></div>
        {study.family.length ? <>
          <p className="chapter-help">Recorded family links between the people listed below. The links may come from other chapters.</p>
          <p className="chapter-help">Scroll sideways to follow the branches. Select a name to open their profile.</p>
          <div ref={mapRef} className="chapter-map-scroll" tabIndex={0} role="region" aria-label="Family preview. Scroll sideways for more names.">
            <svg width={Math.max(forest.w, 290)} height={forest.h} viewBox={`0 0 ${Math.max(forest.w, 290)} ${forest.h}`} aria-label="Family preview">
              <g fill="none" stroke="var(--accent)" strokeWidth={2} aria-hidden="true">
                {previewFamily.filter(r => ["parent_of", "child_of"].includes(r.type)).map(r => {
                  const a = previewNodes.get(r.type === "child_of" ? r.personBId : r.personAId)!;
                  const b = previewNodes.get(r.type === "child_of" ? r.personAId : r.personBId)!;
                  return <path key={r.id} d={`M${a.x},${a.y + 42} V${(a.y + b.y + 42) / 2} H${b.x} V${b.y}`} />;
                })}
                {previewFamily.filter(r => r.type === "spouse_of").map(r => {
                  const a = previewNodes.get(r.personAId)!; const b = previewNodes.get(r.personBId)!;
                  return <path key={r.id} className="chapter-spouse-line" d={`M${a.x},${a.y + 21} L${b.x},${b.y + 21}`} />;
                })}
                {previewFamily.filter(r => ["sibling_of", "ancestor_of", "descendant_of"].includes(r.type)).map(r => {
                  const a = previewNodes.get(r.personAId)!; const b = previewNodes.get(r.personBId)!;
                  return <path key={r.id} className="chapter-extended-line" d={`M${a.x},${a.y + 42} Q${(a.x + b.x) / 2},${Math.max(a.y, b.y) + 75} ${b.x},${b.y + 42}`} />;
                })}
              </g>
              {forest.all.map(n => {
                const p = byId.get(n.id)!;
                const context = !study.directIds.has(n.id);
                return <g key={n.id} className={`chapter-map-node${context ? " context-node" : ""}`} role="button" tabIndex={0} aria-label={`Open ${p.name}${p.alsoKnownAs ? `, ${p.alsoKnownAs}` : ""}${context ? ", broader passage context" : ""}`} onClick={() => onSelect(n.id)} onKeyDown={e => {
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(n.id); }
                }}>
                  <title>{p.name}{p.alsoKnownAs ? ` — ${p.alsoKnownAs}` : ""}</title>
                  <rect x={n.x - 62} y={n.y} width={124} height={44} rx={7} />
                  <text x={n.x} y={n.y + 26} textAnchor="middle">{n.name.length > 15 ? `${n.name.slice(0, 14)}…` : n.name}</text>
                </g>;
              })}
            </svg>
          </div>
          <p className="chapter-map-key"><span>Solid line: parent / child</span><span>Dashed line: spouses</span><span>Dotted line: siblings / ancestry</span>{study.members.some(p => !study.directIds.has(p.id)) && <span>Dashed box: broader reference range</span>}</p>
          {study.previewIds.size < study.members.length && <p className="chapter-help">Previewing {study.previewIds.size} of {study.members.length} names. The passage map includes everyone.</p>}
          <details className="chapter-connections" open={study.connections.length <= 6}>
            <summary>All recorded connections ({study.connections.length})</summary>
            <ul>{study.connections.map(r => <li key={r.id}>
              <button onClick={() => onSelect(r.personAId)}>{byId.get(r.personAId)?.name}</button>
              <span>{RELATIONSHIP_LABELS[r.type]?.toLowerCase() ?? "related to"}</span>
              <button onClick={() => onSelect(r.personBId)}>{byId.get(r.personBId)?.name}</button>
              {r.notes && <small>{r.notes}</small>}
            </li>)}</ul>
          </details>
        </> : <>
          <p className="chapter-help">No family links are recorded between these names. That does not mean they are unrelated.</p>
          {study.connections.length > 0 && <ul className="chapter-other-connections">{study.connections.map(r => <li key={r.id}><button onClick={() => onSelect(r.personAId)}>{byId.get(r.personAId)?.name}</button> {RELATIONSHIP_LABELS[r.type]?.toLowerCase()} <button onClick={() => onSelect(r.personBId)}>{byId.get(r.personBId)?.name}</button></li>)}</ul>}
        </>}
      </section>
      <section className="chapter-history" aria-labelledby="chapter-history-title">
        <h4 id="chapter-history-title">Historical context</h4>
        {coverage && <div className="chapter-book-period"><span>Whole book’s timeline span—not this chapter’s date</span><strong>{formatYearSpan(coverage.startBc, coverage.endBc)}</strong>{coverage.note && <p>{coverage.note}</p>}</div>}
        <h5>Events linked to this passage</h5>
        {loading ? <p className="chapter-help" role="status">Loading linked events…</p> : error ? <div className="chapter-help" role="alert">{error} <button className="btn btn-ghost btn-sm" onClick={() => { setLoading(true); setError(""); setRetry(n => n + 1); }}>Retry</button></div> : history.events.length === 0 ? <p className="chapter-help">No timeline events are linked to this chapter yet. Dates are not inferred from the people listed here.</p> : <ol className="chapter-events">
          {history.events.map(event => <li key={event.id}>
            <span className="chapter-event-date">{event.dateConfidence !== "firm" ? "c. " : ""}{formatYear(event.yearBc)}</span>
            <button className="chapter-event-title" onClick={() => { navigate({ section: "timeline", timelineAct: "everything", timelineQuery: null, timelineBooks: null, timelineOrientation: "vertical", timelineEra: null }); requestEventFocus(event.id, "everything"); }}>{event.title}</button>
            <p>{event.description}</p>
            {event.dateUncertaintyNote && <p className="chapter-help">{event.dateUncertaintyNote}</p>}
            <div className="chapter-event-refs">{history.refs.filter(r => r.eventId === event.id).map(r => <a key={r.id} href={bibleGatewayUrl(r)} target="_blank" rel="noopener noreferrer">{formatRef(r)}{r.chapterStart < chapter ? " (broader range)" : ""}</a>)}</div>
          </li>)}
        </ol>}
      </section>
    </div>
  </section>;
}
