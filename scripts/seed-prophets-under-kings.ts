// Links each prophet to the kings he prophesied under.
//
// Most prophetic books open by dating the ministry to a reign — "the vision
// concerning Judah and Jerusalem that Isaiah son of Amoz saw during the reigns
// of Uzziah, Jotham, Ahaz and Hezekiah". That is the single most asked
// question about a prophet (when was he speaking, and to whom), and none of it
// was in the database.
//
// Only explicit "during the reign of" statements are used. Deliberately left
// out:
//   - Ezekiel, whose dates are anchored to the year of Jehoiachin's exile
//     (Ezekiel 1:2) rather than to a reign.
//   - Joel, Obadiah, Nahum, Habakkuk and Malachi, which name no king at all.
//     Their dates are reconstructed from internal evidence and are exactly the
//     ones scholars disagree about, so inventing a link would be asserting
//     something the text does not.
//   - Jonah, whose book names no king; 2 Kings 14:25 ties him to Jeroboam II,
//     and that link already exists as ally_of.
//
// Jeremiah lists Josiah, Jehoiakim and Zedekiah (Jeremiah 1:2-3). Jehoahaz and
// Jehoiachin each reigned three months inside that span but are not named
// there, so they are not linked.
//
// Run with DRY_RUN=1 to preview without writing.
import { createClient } from "@libsql/client";
import { config } from "dotenv";

config({ path: ".env.local" });
const DRY_RUN = process.env.DRY_RUN === "1";
const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

type Person = [name: string, aka: string];

const PROPHETS: { prophet: Person; source: string; kings: Person[] }[] = [
  {
    prophet: ["Isaiah", "Isaiah son of Amoz"], source: "Isaiah 1:1",
    kings: [
      ["Uzziah", "Uzziah king of Judah, Azariah king of Judah"],
      ["Jotham", "Jotham king of Judah, son of Uzziah"],
      ["Ahaz", "Ahaz king of Judah, son of Jotham"],
      ["Hezekiah", ""],
    ],
  },
  {
    prophet: ["Hosea", "Hosea son of Beeri"], source: "Hosea 1:1",
    kings: [
      ["Uzziah", "Uzziah king of Judah, Azariah king of Judah"],
      ["Jotham", "Jotham king of Judah, son of Uzziah"],
      ["Ahaz", "Ahaz king of Judah, son of Jotham"],
      ["Hezekiah", ""],
      ["Jeroboam", "Jeroboam II king of Israel"],
    ],
  },
  {
    prophet: ["Amos", ""], source: "Amos 1:1",
    kings: [
      ["Uzziah", "Uzziah king of Judah, Azariah king of Judah"],
      ["Jeroboam", "Jeroboam II king of Israel"],
    ],
  },
  {
    prophet: ["Micah", "Micah of Moresheth"], source: "Micah 1:1",
    kings: [
      ["Jotham", "Jotham king of Judah, son of Uzziah"],
      ["Ahaz", "Ahaz king of Judah, son of Jotham"],
      ["Hezekiah", ""],
    ],
  },
  {
    prophet: ["Zephaniah", ""], source: "Zephaniah 1:1",
    kings: [["Josiah", ""]],
  },
  {
    prophet: ["Jeremiah", ""], source: "Jeremiah 1:2-3",
    kings: [
      ["Josiah", ""],
      ["Jehoiakim", "Jehoiakim king of Judah, Eliakim son of Josiah"],
      ["Zedekiah", "Zedekiah king of Judah, Mattaniah son of Josiah"],
    ],
  },
  {
    prophet: ["Haggai", ""], source: "Haggai 1:1",
    kings: [["Darius", "Darius king of Persia"]],
  },
  {
    prophet: ["Zechariah", "Zechariah son of Berechiah"], source: "Zechariah 1:1",
    kings: [["Darius", "Darius king of Persia"]],
  },
];

async function resolve(name: string, aka: string): Promise<{ id: string; name: string }> {
  const r = await db.execute({
    sql: "SELECT id,name FROM people WHERE name = ? AND also_known_as = ?",
    args: [name, aka],
  });
  if (r.rows.length === 1) return r.rows[0] as unknown as { id: string; name: string };
  throw new Error(
    `Refusing to guess: "${name}" (aka "${aka}") matched ${r.rows.length} rows. ` +
    `This database holds four Zechariahs, two Jeroboams, two Jothams and two Amoses.`,
  );
}

async function main() {
  console.log(DRY_RUN ? "DRY RUN — nothing will be written\n" : "");
  let added = 0;
  for (const entry of PROPHETS) {
    const p = await resolve(entry.prophet[0], entry.prophet[1]);
    for (const k of entry.kings) {
      const king = await resolve(k[0], k[1]);
      const existing = await db.execute({
        sql: `SELECT id FROM relationships WHERE person_a_id = ? AND type = 'prophesied_under' AND person_b_id = ?`,
        args: [p.id, king.id],
      });
      if (existing.rows.length) { console.log(`  exists: ${p.name} -> ${king.name}`); continue; }
      console.log(`  ${DRY_RUN ? "would add" : "adding"}: ${p.name} prophesied under ${king.name}  (${entry.source})`);
      if (!DRY_RUN) {
        await db.execute({
          sql: `INSERT OR IGNORE INTO relationships (id,person_a_id,person_a_name,type,person_b_id,person_b_name,notes,created_at)
                VALUES (?,?,?,'prophesied_under',?,?,?,datetime('now'))`,
          args: [crypto.randomUUID(), p.id, p.name, king.id, king.name,
                 `Named in ${entry.source} as a reign his ministry fell within.`],
        });
        added++;
      }
    }
  }
  console.log(`\nDone.${DRY_RUN ? "" : ` ${added} link(s) added.`}`);
}

main();
