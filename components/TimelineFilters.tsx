"use client";
import { BIBLE_BOOKS, BOOK_COVERAGE } from "@/lib/types";

// Only books with a coverage span can appear on this timeline. Grouping
// mirrors how a reader thinks about them, not canonical order.
const GROUPS: { label: string; books: string[] }[] = [
  { label: "Kings & History", books: ["Judges","Ruth","1 Samuel","2 Samuel","1 Kings","2 Kings","1 Chronicles","2 Chronicles","Ezra","Nehemiah","Esther"] },
  { label: "Wisdom & Poetry", books: ["Psalms","Proverbs","Ecclesiastes","Song of Solomon","Lamentations"] },
  { label: "Major Prophets",  books: ["Isaiah","Jeremiah","Ezekiel","Daniel"] },
  { label: "Minor Prophets",  books: ["Hosea","Joel","Amos","Obadiah","Jonah","Micah","Nahum","Habakkuk","Zephaniah","Haggai","Zechariah","Malachi"] },
];

export const TIMELINE_BOOKS: string[] = GROUPS.flatMap(g => g.books);

interface Props {
  checkedBooks: Set<string>;
  showBooksLayer: boolean;
  showPeopleLayer: boolean;
  onToggleBook: (book: string) => void;
  onToggleAll: (checked: boolean) => void;
  onToggleBooksLayer: () => void;
  onTogglePeopleLayer: () => void;
}

export function TimelineFilters({
  checkedBooks, showBooksLayer, showPeopleLayer,
  onToggleBook, onToggleAll, onToggleBooksLayer, onTogglePeopleLayer,
}: Props) {
  const allChecked = TIMELINE_BOOKS.every(b => checkedBooks.has(b));

  return (
    <div className="tl-filters">
      <div className="tl-filters-section">
        <div className="tl-filters-heading">Show</div>
        <label className="tl-switch">
          <input type="checkbox" checked={showPeopleLayer} onChange={onTogglePeopleLayer} />
          <span>People</span>
          <span className="tl-switch-hint">kings, prophets, judges</span>
        </label>
        <label className="tl-switch">
          <input type="checkbox" checked={showBooksLayer} onChange={onToggleBooksLayer} />
          <span>Books</span>
          <span className="tl-switch-hint">the era each book covers</span>
        </label>
      </div>

      <div className="tl-filters-section">
        <div className="tl-filters-heading-row">
          <div className="tl-filters-heading">Filter by book</div>
          <button className="tl-filters-all" onClick={() => onToggleAll(!allChecked)}>
            {allChecked ? "Clear all" : "Select all"}
          </button>
        </div>
        {GROUPS.map(group => (
          <div key={group.label} className="tl-filter-group">
            <div className="tl-filter-group-label">{group.label}</div>
            {group.books.map(book => {
              const cov = BOOK_COVERAGE[book];
              const meta = BIBLE_BOOKS.find(b => b.name === book);
              return (
                <label key={book} className="tl-check" title={meta?.summary ?? ""}>
                  <input
                    type="checkbox"
                    checked={checkedBooks.has(book)}
                    onChange={() => onToggleBook(book)}
                  />
                  <span className="tl-check-name">{book}</span>
                  {cov && (
                    <span className="tl-check-years">
                      {cov.startBc === cov.endBc ? `${cov.startBc}` : `${cov.startBc}–${cov.endBc}`}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
