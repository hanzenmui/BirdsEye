export interface Person {
  id: string;
  name: string;
  alsoKnownAs: string;       // comma-separated aliases
  gender: "male" | "female" | "unknown";
  testament: "OT" | "NT" | "both";
  birthYear: string;         // e.g. "c. 1526 BC" — display string
  deathYear: string;
  description: string;
  tags: string[];            // e.g. ["patriarch", "prophet", "king"]
  createdAt: string;
}

export interface Relationship {
  id: string;
  personAId: string;
  personAName: string;       // denormalized for display
  type: RelationshipType;
  personBId: string;
  personBName: string;       // denormalized for display
  notes: string;
  createdAt: string;
}

export type RelationshipType =
  | "parent_of"
  | "child_of"
  | "spouse_of"
  | "sibling_of"
  | "ancestor_of"
  | "descendant_of"
  | "mentor_of"
  | "disciple_of"
  | "ally_of"
  | "enemy_of"
  | "servant_of"
  | "ruler_of"
  | "other";

export interface ScriptureRef {
  id: string;
  personId: string;
  book: string;
  chapterStart: number;
  verseStart: number;
  chapterEnd: number;
  verseEnd: number;
  note: string;              // brief context note
  createdAt: string;
}

export interface BibleBook {
  name: string;
  testament: "OT" | "NT";
  order: number;
  abbrev: string;
}

export const BIBLE_BOOKS: BibleBook[] = [
  // Old Testament
  { name: "Genesis",        testament: "OT", order: 1,  abbrev: "Gen" },
  { name: "Exodus",         testament: "OT", order: 2,  abbrev: "Exod" },
  { name: "Leviticus",      testament: "OT", order: 3,  abbrev: "Lev" },
  { name: "Numbers",        testament: "OT", order: 4,  abbrev: "Num" },
  { name: "Deuteronomy",    testament: "OT", order: 5,  abbrev: "Deut" },
  { name: "Joshua",         testament: "OT", order: 6,  abbrev: "Josh" },
  { name: "Judges",         testament: "OT", order: 7,  abbrev: "Judg" },
  { name: "Ruth",           testament: "OT", order: 8,  abbrev: "Ruth" },
  { name: "1 Samuel",       testament: "OT", order: 9,  abbrev: "1Sam" },
  { name: "2 Samuel",       testament: "OT", order: 10, abbrev: "2Sam" },
  { name: "1 Kings",        testament: "OT", order: 11, abbrev: "1Kgs" },
  { name: "2 Kings",        testament: "OT", order: 12, abbrev: "2Kgs" },
  { name: "1 Chronicles",   testament: "OT", order: 13, abbrev: "1Chr" },
  { name: "2 Chronicles",   testament: "OT", order: 14, abbrev: "2Chr" },
  { name: "Ezra",           testament: "OT", order: 15, abbrev: "Ezra" },
  { name: "Nehemiah",       testament: "OT", order: 16, abbrev: "Neh" },
  { name: "Esther",         testament: "OT", order: 17, abbrev: "Esth" },
  { name: "Job",            testament: "OT", order: 18, abbrev: "Job" },
  { name: "Psalms",         testament: "OT", order: 19, abbrev: "Ps" },
  { name: "Proverbs",       testament: "OT", order: 20, abbrev: "Prov" },
  { name: "Ecclesiastes",   testament: "OT", order: 21, abbrev: "Eccl" },
  { name: "Song of Solomon", testament: "OT", order: 22, abbrev: "Song" },
  { name: "Isaiah",         testament: "OT", order: 23, abbrev: "Isa" },
  { name: "Jeremiah",       testament: "OT", order: 24, abbrev: "Jer" },
  { name: "Lamentations",   testament: "OT", order: 25, abbrev: "Lam" },
  { name: "Ezekiel",        testament: "OT", order: 26, abbrev: "Ezek" },
  { name: "Daniel",         testament: "OT", order: 27, abbrev: "Dan" },
  { name: "Hosea",          testament: "OT", order: 28, abbrev: "Hos" },
  { name: "Joel",           testament: "OT", order: 29, abbrev: "Joel" },
  { name: "Amos",           testament: "OT", order: 30, abbrev: "Amos" },
  { name: "Obadiah",        testament: "OT", order: 31, abbrev: "Obad" },
  { name: "Jonah",          testament: "OT", order: 32, abbrev: "Jonah" },
  { name: "Micah",          testament: "OT", order: 33, abbrev: "Mic" },
  { name: "Nahum",          testament: "OT", order: 34, abbrev: "Nah" },
  { name: "Habakkuk",       testament: "OT", order: 35, abbrev: "Hab" },
  { name: "Zephaniah",      testament: "OT", order: 36, abbrev: "Zeph" },
  { name: "Haggai",         testament: "OT", order: 37, abbrev: "Hag" },
  { name: "Zechariah",      testament: "OT", order: 38, abbrev: "Zech" },
  { name: "Malachi",        testament: "OT", order: 39, abbrev: "Mal" },
  // New Testament
  { name: "Matthew",        testament: "NT", order: 40, abbrev: "Matt" },
  { name: "Mark",           testament: "NT", order: 41, abbrev: "Mark" },
  { name: "Luke",           testament: "NT", order: 42, abbrev: "Luke" },
  { name: "John",           testament: "NT", order: 43, abbrev: "John" },
  { name: "Acts",           testament: "NT", order: 44, abbrev: "Acts" },
  { name: "Romans",         testament: "NT", order: 45, abbrev: "Rom" },
  { name: "1 Corinthians",  testament: "NT", order: 46, abbrev: "1Cor" },
  { name: "2 Corinthians",  testament: "NT", order: 47, abbrev: "2Cor" },
  { name: "Galatians",      testament: "NT", order: 48, abbrev: "Gal" },
  { name: "Ephesians",      testament: "NT", order: 49, abbrev: "Eph" },
  { name: "Philippians",    testament: "NT", order: 50, abbrev: "Phil" },
  { name: "Colossians",     testament: "NT", order: 51, abbrev: "Col" },
  { name: "1 Thessalonians",testament: "NT", order: 52, abbrev: "1Thess" },
  { name: "2 Thessalonians",testament: "NT", order: 53, abbrev: "2Thess" },
  { name: "1 Timothy",      testament: "NT", order: 54, abbrev: "1Tim" },
  { name: "2 Timothy",      testament: "NT", order: 55, abbrev: "2Tim" },
  { name: "Titus",          testament: "NT", order: 56, abbrev: "Titus" },
  { name: "Philemon",       testament: "NT", order: 57, abbrev: "Phlm" },
  { name: "Hebrews",        testament: "NT", order: 58, abbrev: "Heb" },
  { name: "James",          testament: "NT", order: 59, abbrev: "Jas" },
  { name: "1 Peter",        testament: "NT", order: 60, abbrev: "1Pet" },
  { name: "2 Peter",        testament: "NT", order: 61, abbrev: "2Pet" },
  { name: "1 John",         testament: "NT", order: 62, abbrev: "1John" },
  { name: "2 John",         testament: "NT", order: 63, abbrev: "2John" },
  { name: "3 John",         testament: "NT", order: 64, abbrev: "3John" },
  { name: "Jude",           testament: "NT", order: 65, abbrev: "Jude" },
  { name: "Revelation",     testament: "NT", order: 66, abbrev: "Rev" },
];

export const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  parent_of:     "Parent of",
  child_of:      "Child of",
  spouse_of:     "Spouse of",
  sibling_of:    "Sibling of",
  ancestor_of:   "Ancestor of",
  descendant_of: "Descendant of",
  mentor_of:     "Mentor of",
  disciple_of:   "Disciple of",
  ally_of:       "Ally of",
  enemy_of:      "Enemy of",
  servant_of:    "Servant of",
  ruler_of:      "Ruler of",
  other:         "Related to",
};

export const RELATIONSHIP_COLORS: Record<RelationshipType | "lineage", string> = {
  parent_of:     "rgba(60,45,20,.22)",  // default tree line
  child_of:      "rgba(60,45,20,.22)",
  sibling_of:    "#b45309",             // amber-orange  (blood family)
  spouse_of:     "#e11d48",             // vivid rose-red
  ancestor_of:   "#0891b2",             // cyan           (distant lineage)
  descendant_of: "#0891b2",
  mentor_of:     "#2563eb",             // bright blue
  disciple_of:   "#2563eb",
  ally_of:       "#16a34a",             // green
  servant_of:    "#059669",             // emerald
  enemy_of:      "#dc2626",             // red
  ruler_of:      "#d97706",             // amber-gold
  other:         "#6b7280",             // gray
  lineage:       "#7c3aed",             // Adam → Jesus violet
};

// Inverse labels for when the current person is person B in the relationship
export const RELATIONSHIP_INVERSE_LABELS: Record<RelationshipType, string> = {
  parent_of:     "Child of",
  child_of:      "Parent of",
  spouse_of:     "Spouse of",
  sibling_of:    "Sibling of",
  ancestor_of:   "Descendant of",
  descendant_of: "Ancestor of",
  mentor_of:     "Disciple of",
  disciple_of:   "Mentor of",
  ally_of:       "Ally of",
  enemy_of:      "Enemy of",
  servant_of:    "Master of",
  ruler_of:      "Subject of",
  other:         "Related to",
};
