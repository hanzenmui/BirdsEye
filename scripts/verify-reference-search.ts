// Checks the search box's reference parser. The tricky cases are books whose
// names are prefixes of other books ("Jude" vs "Judges", "John" vs "1 John")
// and numbered books, where a naive parse grabs the leading "1" as a chapter.
import { parseReferenceQuery } from "../lib/mappers";
import { BIBLE_BOOKS } from "../lib/types";

type Expect = { book: string; chapter: number | null } | null;
const CASES: [string, Expect][] = [
  ["genesis 38",  { book: "Genesis", chapter: 38 }],
  ["Genesis 38",  { book: "Genesis", chapter: 38 }],
  ["gen 38",      { book: "Genesis", chapter: 38 }],
  ["genesis",     { book: "Genesis", chapter: null }],
  ["2 kings 18",  { book: "2 Kings", chapter: 18 }],
  ["2 Kings",     { book: "2 Kings", chapter: null }],
  ["1 samuel 17", { book: "1 Samuel", chapter: 17 }],
  ["1 kings",     { book: "1 Kings", chapter: null }],
  ["judges 1",    { book: "Judges", chapter: 1 }],
  ["jude",        { book: "Jude", chapter: null }],
  ["john 3",      { book: "John", chapter: 3 }],
  ["1 john 4",    { book: "1 John", chapter: 4 }],
  ["psalm 23",    { book: "Psalms", chapter: 23 }],
  ["genesis 38:1",{ book: "Genesis", chapter: 38 }],
  ["  genesis   38  ", { book: "Genesis", chapter: 38 }],
  // Not references — must fall through to ordinary name searching.
  ["38",          null],
  ["",            null],
  ["moses",       null],
  ["high priest", null],
];

let failed = 0;
for (const [input, expected] of CASES) {
  const got = parseReferenceQuery(input, BIBLE_BOOKS);
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  if (!ok) { failed++; console.log(`  FAIL  "${input}"\n        expected ${JSON.stringify(expected)}\n        got      ${JSON.stringify(got)}`); }
  else console.log(`  ok    "${input}" -> ${JSON.stringify(got)}`);
}
console.log(failed ? `\n${failed} case(s) failed.` : `\nAll ${CASES.length} cases passed.`);
if (failed) process.exit(1);
