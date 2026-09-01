"use client";

import { BIBLE_BOOKS, BOOK_COVERAGE } from "@/lib/types";

const GROUPS: { label: string; books: string[] }[] = [
  { label: "Kings & History", books: ["Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther"] },
  { label: "Wisdom & Poetry", books: ["Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon", "Lamentations"] },
  { label: "Major Prophets", books: ["Isaiah", "Jeremiah", "Ezekiel", "Daniel"] },
  { label: "Minor Prophets", books: ["Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi"] },
];

export const TIMELINE_BOOKS: string[] = GROUPS.flatMap(group => group.books);

interface Props {
  checkedBooks: Set<string>;
  showBooksLayer: boolean;
  showPeopleLayer: boolean;
  showEventsLayer: boolean;
  query: string;
  resultCount: number;
  onQueryChange: (query: string) => void;
  onToggleBook: (book: string) => void;
  onToggleAll: (checked: boolean) => void;
  onToggleBooksLayer: () => void;
  onTogglePeopleLayer: () => void;
  onToggleEventsLayer: () => void;
  open: boolean;
  onToggleOpen: () => void;
}

export function TimelineFilters({
  checkedBooks,
  showBooksLayer,
  showPeopleLayer,
  showEventsLayer,
  query,
  resultCount,
  onQueryChange,
  onToggleBook,
  onToggleAll,
  onToggleBooksLayer,
  onTogglePeopleLayer,
  onToggleEventsLayer,
  open,
  onToggleOpen,
}: Props) {
  const allChecked = TIMELINE_BOOKS.every(book => checkedBooks.has(book));

  return (
    <div className="tlv-tools">
      <div className="tlv-tools-main">
        <label className="tlv-search">
          <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.4-3.4" />
          </svg>
          <span className="sr-only">Find someone or an event</span>
          <input
            type="search"
            value={query}
            onChange={event => onQueryChange(event.target.value)}
            placeholder="Find a person or event…"
          />
          {query && (
            <button type="button" onClick={() => onQueryChange("")} aria-label="Clear search">×</button>
          )}
        </label>

        <div className="tlv-layer-toggles" aria-label="Timeline layers">
          <button type="button" className={showPeopleLayer ? "active" : ""} aria-pressed={showPeopleLayer} onClick={onTogglePeopleLayer}>People</button>
          <button type="button" className={showEventsLayer ? "active" : ""} aria-pressed={showEventsLayer} onClick={onToggleEventsLayer}>Events</button>
          <button type="button" className={showBooksLayer ? "active" : ""} aria-pressed={showBooksLayer} onClick={onToggleBooksLayer}>Book bands</button>
        </div>

        <button type="button" className={`tlv-books-trigger${open ? " active" : ""}`} onClick={onToggleOpen} aria-expanded={open}>
          <span>Filter books</span>
          <span className="tlv-books-count">{checkedBooks.size}/{TIMELINE_BOOKS.length}</span>
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className={open ? "open" : ""}>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>

      <div className="tlv-result-count" aria-live="polite">
        {resultCount} {resultCount === 1 ? "timeline entry" : "timeline entries"}
      </div>

      {open && (
        <div className="tlv-book-drawer">
          <div className="tlv-book-drawer-top">
            <div>
              <strong>Which books should shape the story?</strong>
              <span>People and events appear when they are mentioned in a selected book.</span>
            </div>
            <button type="button" onClick={() => onToggleAll(!allChecked)}>{allChecked ? "Clear all" : "Select all"}</button>
          </div>

          <div className="tlv-book-groups">
            {GROUPS.map(group => (
              <fieldset key={group.label} className="tlv-book-group">
                <legend>{group.label}</legend>
                <div className="tlv-book-checks">
                  {group.books.map(book => {
                    const coverage = BOOK_COVERAGE[book];
                    const meta = BIBLE_BOOKS.find(candidate => candidate.name === book);
                    return (
                      <label key={book} title={meta?.summary ?? ""}>
                        <input type="checkbox" checked={checkedBooks.has(book)} onChange={() => onToggleBook(book)} />
                        <span>{book}</span>
                        {coverage && <small>{coverage.startBc}–{coverage.endBc}</small>}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
