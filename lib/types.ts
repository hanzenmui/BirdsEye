export const GENDERS = ["male", "female", "unknown"] as const;
export const TESTAMENTS = ["OT", "NT", "both"] as const;

export const TIMELINE_TRACKS = [
  "judah_king", "israel_king", "united_king", "judge", "major_prophet", "minor_prophet",
] as const;
export type TimelineTrack = (typeof TIMELINE_TRACKS)[number] | "";

export const DATE_CONFIDENCES = ["firm", "good", "uncertain"] as const;
export type DateConfidence = (typeof DATE_CONFIDENCES)[number];

export interface Person {
  id: string;
  name: string;
  alsoKnownAs: string;       // comma-separated aliases
  gender: (typeof GENDERS)[number];
  testament: (typeof TESTAMENTS)[number];
  birthYear: string;         // e.g. "c. 1526 BC" — display string
  deathYear: string;
  description: string;
  tags: string[];            // e.g. ["patriarch", "prophet", "king"]
  createdAt: string;
  // Timeline fields — null/empty for people not placed on the timeline.
  timelineStartBc: number | null;   // BC year as positive int; 931 = 931 BC
  timelineEndBc: number | null;
  timelineTrack: TimelineTrack;
  dateUncertaintyNote: string;
  dateConfidence: DateConfidence;
}

export interface HistoricalEvent {
  id: string;
  title: string;
  yearBc: number;
  era: string;
  description: string;
  dateUncertaintyNote: string;
  dateConfidence: DateConfidence;
  createdAt: string;
}

export interface ProphecyLink {
  id: string;
  prophetPersonId: string;
  prophecyBook: string;
  prophecyChapterStart: number;
  prophecyVerseStart: number;
  prophecyChapterEnd: number;
  prophecyVerseEnd: number;
  fulfillmentEventId: string;
  explanation: string;
  uncertaintyNote: string;
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
  | "adversary_of"
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
  eventId: string | null;
}

export interface BibleBook {
  name: string;
  testament: "OT" | "NT";
  order: number;
  abbrev: string;
  summary: string;
}

export const BIBLE_BOOKS: BibleBook[] = [
  // Old Testament
  { name: "Genesis",         testament: "OT", order: 1,  abbrev: "Gen",    summary: "Creation, the Fall, Noah's flood, and the stories of Abraham, Isaac, Jacob, and Joseph." },
  { name: "Exodus",          testament: "OT", order: 2,  abbrev: "Exod",   summary: "Moses leads Israel out of Egyptian slavery; God gives the Law and the Ten Commandments at Sinai." },
  { name: "Leviticus",       testament: "OT", order: 3,  abbrev: "Lev",    summary: "Laws on worship, sacrifice, and holiness given to Israel through the priests." },
  { name: "Numbers",         testament: "OT", order: 4,  abbrev: "Num",    summary: "Israel wanders forty years in the wilderness after failing to trust God at Canaan's border." },
  { name: "Deuteronomy",     testament: "OT", order: 5,  abbrev: "Deut",   summary: "Moses retells the Law to a new generation standing on the edge of the Promised Land." },
  { name: "Joshua",          testament: "OT", order: 6,  abbrev: "Josh",   summary: "Joshua leads Israel's conquest and settlement of Canaan after Moses' death." },
  { name: "Judges",          testament: "OT", order: 7,  abbrev: "Judg",   summary: "A cycle of Israel's unfaithfulness, oppression, and rescue by Spirit-filled judges." },
  { name: "Ruth",            testament: "OT", order: 8,  abbrev: "Ruth",   summary: "A Moabite widow's loyalty to her mother-in-law leads her into the lineage of King David." },
  { name: "1 Samuel",        testament: "OT", order: 9,  abbrev: "1Sam",   summary: "Israel transitions from judges to monarchy; Samuel anoints Saul, then David, as king." },
  { name: "2 Samuel",        testament: "OT", order: 10, abbrev: "2Sam",   summary: "David's reign over a united Israel — his victories, sins, and their consequences." },
  { name: "1 Kings",         testament: "OT", order: 11, abbrev: "1Kgs",   summary: "Solomon builds the Temple; after his death the kingdom splits into Israel and Judah." },
  { name: "2 Kings",         testament: "OT", order: 12, abbrev: "2Kgs",   summary: "The decline and fall of both kingdoms — Israel exiled to Assyria, Judah to Babylon." },
  { name: "1 Chronicles",    testament: "OT", order: 13, abbrev: "1Chr",   summary: "A genealogical history of Israel culminating in David's reign and Temple preparations." },
  { name: "2 Chronicles",    testament: "OT", order: 14, abbrev: "2Chr",   summary: "Solomon's Temple, the divided kingdom, and Judah's kings through the Babylonian exile." },
  { name: "Ezra",            testament: "OT", order: 15, abbrev: "Ezra",   summary: "The first return of Jewish exiles from Babylon and the rebuilding of the Temple." },
  { name: "Nehemiah",        testament: "OT", order: 16, abbrev: "Neh",    summary: "Nehemiah leads the rebuilding of Jerusalem's walls and calls the people to covenant renewal." },
  { name: "Esther",          testament: "OT", order: 17, abbrev: "Esth",   summary: "A Jewish queen in Persia risks her life to save her people from genocide." },
  { name: "Job",             testament: "OT", order: 18, abbrev: "Job",    summary: "A righteous man endures catastrophic suffering and wrestles with God over justice and theodicy." },
  { name: "Psalms",          testament: "OT", order: 19, abbrev: "Ps",     summary: "150 poems and songs spanning the full range of human prayer — lament, praise, and trust." },
  { name: "Proverbs",        testament: "OT", order: 20, abbrev: "Prov",   summary: "Practical wisdom sayings, mostly from Solomon, on how to live a God-fearing, virtuous life." },
  { name: "Ecclesiastes",    testament: "OT", order: 21, abbrev: "Eccl",   summary: "A philosopher's meditation on the vanity of life and the importance of fearing God." },
  { name: "Song of Solomon", testament: "OT", order: 22, abbrev: "Song",   summary: "A poetic celebration of romantic love between a bride and her beloved." },
  { name: "Isaiah",          testament: "OT", order: 23, abbrev: "Isa",    summary: "Prophetic visions of judgment on Israel and the nations, and the coming of a Suffering Servant who brings salvation." },
  { name: "Jeremiah",        testament: "OT", order: 24, abbrev: "Jer",    summary: "Jeremiah's anguished warnings of Babylon's coming destruction of Jerusalem and a future new covenant." },
  { name: "Lamentations",    testament: "OT", order: 25, abbrev: "Lam",    summary: "Five lament poems mourning the devastation of Jerusalem after its fall to Babylon." },
  { name: "Ezekiel",         testament: "OT", order: 26, abbrev: "Ezek",   summary: "Vivid prophetic visions — God's glory departing the Temple, the valley of dry bones, and Israel's future restoration." },
  { name: "Daniel",          testament: "OT", order: 27, abbrev: "Dan",    summary: "A Jewish exile's faithfulness in Babylon and apocalyptic visions of world empires and God's eternal kingdom." },
  { name: "Hosea",           testament: "OT", order: 28, abbrev: "Hos",    summary: "God's covenant love for unfaithful Israel illustrated through Hosea's marriage to an adulterous wife." },
  { name: "Joel",            testament: "OT", order: 29, abbrev: "Joel",   summary: "A locust plague becomes a call to repentance and a promise of God's Spirit poured out on all people." },
  { name: "Amos",            testament: "OT", order: 30, abbrev: "Amos",   summary: "A shepherd-prophet confronts Israel's social injustice and hollow religious ritual." },
  { name: "Obadiah",         testament: "OT", order: 31, abbrev: "Obad",   summary: "The shortest OT book — a prophecy of judgment against Edom for betraying Israel." },
  { name: "Jonah",           testament: "OT", order: 32, abbrev: "Jonah",  summary: "A reluctant prophet flees God's call, is swallowed by a great fish, and witnesses Nineveh's repentance." },
  { name: "Micah",           testament: "OT", order: 33, abbrev: "Mic",    summary: "Prophecies of judgment on corrupt leaders and hope — including the Messiah born in Bethlehem." },
  { name: "Nahum",           testament: "OT", order: 34, abbrev: "Nah",    summary: "A poetic oracle announcing the coming destruction of Nineveh, Assyria's brutal capital." },
  { name: "Habakkuk",        testament: "OT", order: 35, abbrev: "Hab",    summary: "A prophet wrestles with why God allows evil, and receives the answer to live by faith." },
  { name: "Zephaniah",       testament: "OT", order: 36, abbrev: "Zeph",   summary: "Warning of the coming Day of the Lord's judgment, and a promise of restoration for the remnant." },
  { name: "Haggai",          testament: "OT", order: 37, abbrev: "Hag",    summary: "A post-exile prophet urges returned exiles to stop delaying and finish rebuilding the Temple." },
  { name: "Zechariah",       testament: "OT", order: 38, abbrev: "Zech",   summary: "Visions encouraging Temple rebuilding and messianic prophecies fulfilled in Jesus — including a king on a donkey." },
  { name: "Malachi",         testament: "OT", order: 39, abbrev: "Mal",    summary: "The last OT prophet rebukes Israel's faithlessness and promises a messenger before the great day of the Lord." },
  // New Testament
  { name: "Matthew",         testament: "NT", order: 40, abbrev: "Matt",   summary: "Jesus presented as the Jewish Messiah fulfilling OT prophecy — his teaching, miracles, death, and resurrection." },
  { name: "Mark",            testament: "NT", order: 41, abbrev: "Mark",   summary: "The fastest-paced Gospel — Jesus as a powerful servant who acts decisively before going to the cross." },
  { name: "Luke",            testament: "NT", order: 42, abbrev: "Luke",   summary: "A physician's careful account emphasizing Jesus' compassion for the poor, women, and outsiders." },
  { name: "John",            testament: "NT", order: 43, abbrev: "John",   summary: "A theological Gospel built on seven signs and 'I am' sayings revealing Jesus as the divine Son of God." },
  { name: "Acts",            testament: "NT", order: 44, abbrev: "Acts",   summary: "The Holy Spirit launches the early church from Jerusalem to Rome through the apostles Paul and Peter." },
  { name: "Romans",          testament: "NT", order: 45, abbrev: "Rom",    summary: "Paul's most systematic letter — justification by faith alone, sin, grace, and life in the Spirit." },
  { name: "1 Corinthians",   testament: "NT", order: 46, abbrev: "1Cor",   summary: "Paul addresses a divided and immoral church, with the famous chapter on love and teaching on resurrection." },
  { name: "2 Corinthians",   testament: "NT", order: 47, abbrev: "2Cor",   summary: "Paul defends his apostolic authority and explains how weakness and suffering display God's power." },
  { name: "Galatians",       testament: "NT", order: 48, abbrev: "Gal",    summary: "A passionate defense of salvation by grace through faith, not law-keeping — the Magna Carta of Christian freedom." },
  { name: "Ephesians",       testament: "NT", order: 49, abbrev: "Eph",    summary: "The mystery of the church as Christ's body, and practical instructions for unified, Spirit-filled living." },
  { name: "Philippians",     testament: "NT", order: 50, abbrev: "Phil",   summary: "A joyful letter from prison urging unity, humility following Christ's example, and contentment in all circumstances." },
  { name: "Colossians",      testament: "NT", order: 51, abbrev: "Col",    summary: "Christ is supreme over all creation and all spiritual powers — a warning against adding to the gospel." },
  { name: "1 Thessalonians", testament: "NT", order: 52, abbrev: "1Thess", summary: "Encouragement for a young persecuted church and teaching on the resurrection and Christ's return." },
  { name: "2 Thessalonians", testament: "NT", order: 53, abbrev: "2Thess", summary: "Correcting confusion about the Day of the Lord and calling believers to persevere in faithful work." },
  { name: "1 Timothy",       testament: "NT", order: 54, abbrev: "1Tim",   summary: "Paul's instructions to a young pastor on church leadership, sound doctrine, and godly conduct." },
  { name: "2 Timothy",       testament: "NT", order: 55, abbrev: "2Tim",   summary: "Paul's final letter — a charge to Timothy to guard the gospel and endure hardship to the end." },
  { name: "Titus",           testament: "NT", order: 56, abbrev: "Titus",  summary: "Instructions for establishing godly church order and sound teaching on the island of Crete." },
  { name: "Philemon",        testament: "NT", order: 57, abbrev: "Phlm",   summary: "A personal appeal from Paul asking a slave owner to receive back his runaway slave as a brother." },
  { name: "Hebrews",         testament: "NT", order: 58, abbrev: "Heb",    summary: "Jesus as the ultimate high priest and fulfillment of the entire OT sacrificial system — better in every way." },
  { name: "James",           testament: "NT", order: 59, abbrev: "Jas",    summary: "Practical wisdom on faith proven by works, taming the tongue, and caring for the poor." },
  { name: "1 Peter",         testament: "NT", order: 60, abbrev: "1Pet",   summary: "Hope and endurance for suffering Christians who are 'strangers' in the world." },
  { name: "2 Peter",         testament: "NT", order: 61, abbrev: "2Pet",   summary: "A warning against false teachers and confidence in the return of Christ despite mockers." },
  { name: "1 John",          testament: "NT", order: 62, abbrev: "1John",  summary: "Assurance of salvation rooted in love for God, love for others, and rejection of sin." },
  { name: "2 John",          testament: "NT", order: 63, abbrev: "2John",  summary: "A brief warning to a local church not to welcome teachers who deny Christ's incarnation." },
  { name: "3 John",          testament: "NT", order: 64, abbrev: "3John",  summary: "A personal commendation of Gaius for his hospitality to traveling missionaries." },
  { name: "Jude",            testament: "NT", order: 65, abbrev: "Jude",   summary: "An urgent call to defend the faith against ungodly people who have crept into the church." },
  { name: "Revelation",      testament: "NT", order: 66, abbrev: "Rev",    summary: "Apocalyptic visions given to John — the cosmic war between good and evil, and Christ's ultimate victory." },
];

// ── Book coverage spans (for the timeline's Books layer) ────────────────────
// The period each book NARRATES — deliberately not the date it was written.
// Composition dates are heavily disputed for many books (whether Moses wrote
// the Torah, whether Isaiah 40-66 is exilic, and so on); the period a book
// covers is not. Keeping to coverage lets the Books layer sit honestly
// alongside the people without taking a position on authorship.
//
// Prophetic books span their prophet's active ministry, and those values
// intentionally mirror the ministry dates in scripts/seed-timeline.ts —
// scripts/verify-timeline.ts asserts the two agree so they cannot drift.
//
// Only books overlapping Phase 1 (roughly 1350-430 BC) are listed. Genesis
// through Joshua and the entire New Testament arrive with later phases.
export interface BookCoverage {
  startBc: number;
  endBc: number;
  note?: string;
}

export const BOOK_COVERAGE: Record<string, BookCoverage> = {
  // ── Narrative ─────────────────────────────────────────────────────────
  "Judges":          { startBc: 1350, endBc: 1050, note: "The judges did not rule in sequence — several overlapped — so this span is the era as a whole, not a chain." },
  "Ruth":            { startBc: 1120, endBc: 1100, note: "Set 'in the days when the judges ruled'; placed by working back from Boaz being David's great-grandfather." },
  "1 Samuel":        { startBc: 1100, endBc: 1010 },
  "2 Samuel":        { startBc: 1010, endBc:  970 },
  "1 Kings":         { startBc:  970, endBc:  850 },
  "2 Kings":         { startBc:  850, endBc:  586 },
  "1 Chronicles":    { startBc: 1010, endBc:  970, note: "The narrative covers David's reign; its opening genealogies reach much further back, to Adam." },
  "2 Chronicles":    { startBc:  970, endBc:  538 },
  "Ezra":            { startBc:  538, endBc:  458 },
  "Nehemiah":        { startBc:  445, endBc:  432 },
  "Esther":          { startBc:  483, endBc:  473, note: "Set in the reign of Xerxes I (486-465 BC); the events span his third through twelfth years." },
  "Lamentations":    { startBc:  586, endBc:  585, note: "Written in the immediate aftermath of Jerusalem's fall." },

  // ── Wisdom & poetry ───────────────────────────────────────────────────
  "Psalms":          { startBc: 1010, endBc:  430, note: "A collection assembled over centuries — from David's psalms through post-exilic additions — rather than a single moment." },
  "Proverbs":        { startBc:  970, endBc:  931, note: "Placed at Solomon's reign, though the book itself notes later material collected under Hezekiah (Prov 25:1)." },
  "Ecclesiastes":    { startBc:  970, endBc:  931 },
  "Song of Solomon": { startBc:  970, endBc:  931 },

  // ── Prophets (span = the prophet's active ministry) ───────────────────
  "Isaiah":          { startBc:  740, endBc:  680 },
  "Jeremiah":        { startBc:  627, endBc:  580 },
  "Ezekiel":         { startBc:  593, endBc:  570 },
  "Daniel":          { startBc:  605, endBc:  530 },
  "Hosea":           { startBc:  760, endBc:  710 },
  "Joel":            { startBc:  835, endBc:  796, note: "Joel is not internally dated; proposals range from the 9th century BC to the 2nd. Placed here in the early pre-exilic range." },
  "Amos":            { startBc:  760, endBc:  750 },
  "Obadiah":         { startBc:  845, endBc:  840, note: "Obadiah is not internally dated; some place him in the 840s BC, others after Jerusalem's fall in 586 BC." },
  "Jonah":           { startBc:  780, endBc:  750 },
  "Micah":           { startBc:  740, endBc:  700 },
  "Nahum":           { startBc:  663, endBc:  612, note: "Bracketed by events he names: Thebes' fall (663 BC) is already past, Nineveh's fall (612 BC) still future." },
  "Habakkuk":        { startBc:  608, endBc:  598, note: "Sources split between c. 630 BC and c. 608-598 BC. Placed in the later window, since the Chaldean threat is his subject." },
  "Zephaniah":       { startBc:  630, endBc:  627 },
  "Haggai":          { startBc:  520, endBc:  520, note: "A ministry of only about four months." },
  "Zechariah":       { startBc:  520, endBc:  518 },
  "Malachi":         { startBc:  450, endBc:  430 },
};

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
  adversary_of:  "Adversary of",
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
  adversary_of:  "#9f1239",             // rose-maroon (distinct from enemy_of's red)
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
  adversary_of:  "Adversary of",
  servant_of:    "Master of",
  ruler_of:      "Subject of",
  other:         "Related to",
};
