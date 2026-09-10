// The succession of the kings of Israel — the dynasties and the coups.
//
// Thirteen northern kings had no recorded relationships at all, which is odd
// for a kingdom whose entire story is one house violently replacing another.
// The Omride and Jehu kings were already connected; the chain between and
// after them was missing, so the Family Tree showed the northern kingdom as a
// row of unrelated names.
//
// Every link below was checked against the text. Two traps were avoided:
//
//   Baasha's father is "Ahijah from the tribe of Issachar" (1 Kings 15:27),
//   NOT Ahijah the Shilonite, the prophet who is in the database — the same
//   passage names both men three verses apart. No link is made.
//
//   Hoshea is "son of Elah" (2 Kings 15:30), but that Elah is not Elah king
//   of Israel, son of Baasha, who died forty years before Hoshea reigned. No
//   link is made.
//
// Fathers named only in passing and not in the database (Jabesh, Gadi,
// Remaliah, Nebat) are deliberately not added — this script connects people
// who already exist rather than inflating the database with names that appear
// once as patronymics.
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

type Link = { a: [string, string]; type: string; b: [string, string]; notes: string };

const K = (aka: string): [string, string] => {
  const name = aka.split(" ")[0];
  return [name, aka];
};

const LINKS: Link[] = [
  // ── Fathers and sons ────────────────────────────────────────────────────
  { a: ["Jeroboam", "Jeroboam son of Nebat"], type: "parent_of", b: K("Nadab king of Israel"),
    notes: "Nadab son of Jeroboam became king of Israel (1 Kings 15:25)." },
  { a: K("Baasha king of Israel"), type: "parent_of", b: K("Elah king of Israel"),
    notes: "Elah son of Baasha became king of Israel (1 Kings 16:8)." },
  { a: K("Omri king of Israel"), type: "parent_of", b: ["Ahab", ""],
    notes: "Ahab son of Omri became king of Israel (1 Kings 16:29)." },
  { a: ["Jehu", "Jehu son of Jehoshaphat"], type: "parent_of", b: K("Jehoahaz king of Israel"),
    notes: "Jehoahaz son of Jehu became king of Israel (2 Kings 13:1)." },
  { a: K("Jehoahaz king of Israel"), type: "parent_of", b: K("Jehoash king of Israel"),
    notes: "Jehoash his son succeeded him as king (2 Kings 13:9-10)." },
  { a: K("Jehoash king of Israel"), type: "parent_of", b: ["Jeroboam", "Jeroboam II king of Israel"],
    notes: "Jeroboam son of Jehoash king of Israel became king (2 Kings 14:23)." },
  { a: ["Jeroboam", "Jeroboam II king of Israel"], type: "parent_of", b: ["Zechariah", "Zechariah king of Israel"],
    notes: "Zechariah his son succeeded him as king (2 Kings 14:29, 15:8)." },
  { a: K("Menahem king of Israel"), type: "parent_of", b: K("Pekahiah king of Israel"),
    notes: "Pekahiah his son succeeded him as king (2 Kings 15:22-23)." },

  // ── The coups: each assassin and the king he replaced ───────────────────
  { a: K("Baasha king of Israel"), type: "enemy_of", b: K("Nadab king of Israel"),
    notes: "Struck Nadab down at Gibbethon and killed Jeroboam's whole family (1 Kings 15:27-29)." },
  { a: K("Zimri king of Israel"), type: "enemy_of", b: K("Elah king of Israel"),
    notes: "Commander of half the chariots; killed Elah as he drank in Tirzah (1 Kings 16:9-10)." },
  { a: K("Omri king of Israel"), type: "enemy_of", b: K("Zimri king of Israel"),
    notes: "Proclaimed king by the army and besieged Tirzah; Zimri died in the burning palace after seven days (1 Kings 16:16-18)." },
  { a: K("Shallum king of Israel"), type: "enemy_of", b: ["Zechariah", "Zechariah king of Israel"],
    notes: "Assassinated Zechariah in front of the people, ending Jehu's dynasty in its fourth generation (2 Kings 15:10-12)." },
  { a: K("Menahem king of Israel"), type: "enemy_of", b: K("Shallum king of Israel"),
    notes: "Came up from Tirzah and assassinated Shallum after a one-month reign (2 Kings 15:14)." },
  { a: K("Pekah king of Israel"), type: "enemy_of", b: K("Pekahiah king of Israel"),
    notes: "A chief officer; assassinated Pekahiah in the citadel of the palace at Samaria (2 Kings 15:25)." },
  { a: K("Hoshea king of Israel"), type: "enemy_of", b: K("Pekah king of Israel"),
    notes: "Assassinated Pekah and became Israel's last king (2 Kings 15:30)." },
];

async function resolve(name: string, aka: string): Promise<{ id: string; name: string }> {
  const r = await db.execute({
    sql: "SELECT id,name FROM people WHERE name = ? AND also_known_as = ?",
    args: [name, aka],
  });
  if (r.rows.length === 1) return r.rows[0] as unknown as { id: string; name: string };
  throw new Error(
    `Refusing to guess: "${name}" (aka "${aka}") matched ${r.rows.length} rows. ` +
    `Four different Zechariahs and two Jeroboams live in this database.`,
  );
}

async function main() {
  console.log(DRY_RUN ? "DRY RUN — nothing will be written\n" : "");
  let added = 0;
  for (const l of LINKS) {
    const a = await resolve(l.a[0], l.a[1]);
    const b = await resolve(l.b[0], l.b[1]);
    const existing = await db.execute({
      sql: `SELECT id FROM relationships WHERE person_a_id = ? AND type = ? AND person_b_id = ?`,
      args: [a.id, l.type, b.id],
    });
    if (existing.rows.length) { console.log(`  exists: ${a.name} ${l.type} ${b.name}`); continue; }
    console.log(`  ${DRY_RUN ? "would add" : "adding"}: ${a.name} ${l.type} ${b.name}`);
    if (!DRY_RUN) {
      await db.execute({
        sql: `INSERT OR IGNORE INTO relationships (id,person_a_id,person_a_name,type,person_b_id,person_b_name,notes,created_at)
              VALUES (?,?,?,?,?,?,?,datetime('now'))`,
        args: [crypto.randomUUID(), a.id, a.name, l.type, b.id, b.name, l.notes],
      });
      added++;
    }
  }
  console.log(`\nDone.${DRY_RUN ? "" : ` ${added} relationship(s) added.`}`);
}

main();
