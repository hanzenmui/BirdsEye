import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN ?? process.env.TURSO_DATABASE_TURSO_AUTH_TOKEN,
});

const DRY_RUN = process.argv.includes("--dry-run");

// ── helpers ────────────────────────────────────────────────────────────────
const existingIds: Record<string, string> = {};
const names: Record<string, string> = {};

// Resolve the DB id for a person already in the seed data, by exact name
// (and, when given, also_known_as) match. Throws if not found — this script
// must never silently proceed against a live DB with an unresolved id.
async function resolveExisting(key: string, name: string, alsoKnownAs?: string): Promise<string> {
  if (existingIds[key]) return existingIds[key];
  const row = alsoKnownAs !== undefined
    ? await db.execute({
        sql: "SELECT id, name FROM people WHERE name = ? AND also_known_as = ? LIMIT 1",
        args: [name, alsoKnownAs],
      })
    : await db.execute({
        sql: "SELECT id, name FROM people WHERE name = ? LIMIT 1",
        args: [name],
      });
  const r = row.rows[0] as unknown as { id: string; name: string } | undefined;
  if (!r) {
    throw new Error(
      `resolveExisting: could not find existing person for key="${key}" name="${name}" akas="${alsoKnownAs ?? ""}" — aborting, refusing to guess against live DB`
    );
  }
  existingIds[key] = r.id;
  names[key] = r.name;
  return r.id;
}

type Stmt = { sql: string; args: unknown[] };

const plannedStatements: { citation: string; description: string; stmt: Stmt }[] = [];

async function run(citation: string, description: string, stmt: Stmt) {
  plannedStatements.push({ citation, description, stmt });
  if (DRY_RUN) {
    console.log(`\n[${citation}] ${description}`);
    console.log(`  SQL:  ${stmt.sql.replace(/\s+/g, " ").trim()}`);
    console.log(`  ARGS: ${JSON.stringify(stmt.args)}`);
    return;
  }
  await db.execute({ sql: stmt.sql, args: stmt.args as (string | number | null)[] });
}

// ── main correction routine ─────────────────────────────────────────────────
async function main() {
  console.log(DRY_RUN ? "=== DRY RUN — no statements will be executed ===" : "=== LIVE RUN — mutating database ===");

  // Resolve all existing people this script needs to reference, up front.
  const bartholomewId = await resolveExisting("bartholomew", "Bartholomew", "Bartholomew the Apostle, Nathanael");
  const thomasId = await resolveExisting("thomas", "Thomas", "Thomas the Apostle, Doubting Thomas, Didymus");
  const nicodemusId = await resolveExisting("nicodemus", "Nicodemus");
  const marthaId = await resolveExisting("martha", "Martha", "Martha of Bethany");
  const maryMagdaleneId = await resolveExisting("mary_magdalene", "Mary Magdalene", "Mary of Magdala");
  const maryBethanyId = await resolveExisting("mary_bethany", "Mary of Bethany", "Mary of Bethany, sister of Martha");
  const jairusId = await resolveExisting("jairus", "Jairus");

  // ───────────────────────────────────────────────────────────────────────
  // Finding 1: bartholomew.description (scripts/seed-nt-ministry.ts line
  // 122) paraphrases John 1:47 ("Here is truly an Israelite in whom there
  // is no deceit") rather than quoting the ESV's actual wording ("Behold,
  // an Israelite indeed, in whom there is no deceit!").
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 1", `UPDATE people.description for bartholomew (id: ${bartholomewId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Apostle traditionally identified with Nathanael of Cana in Galilee whom Philip brought to Jesus. When Philip said 'We have found him,' Nathanael skeptically asked 'Can anything good come out of Nazareth?' Jesus saw him coming and said 'Behold, an Israelite indeed, in whom there is no deceit!' Nathanael asked how Jesus knew him; Jesus said he saw him under the fig tree before Philip called him. Nathanael immediately confessed 'Rabbi, you are the Son of God! You are the King of Israel!' Was present at the resurrection appearance by the Sea of Tiberias.",
      bartholomewId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 2: thomas.description (scripts/seed-nt-ministry.ts line 132)
  // reorders words and substitutes "not" for "never" against John 20:25's
  // actual wording ("Unless I see in his hands the mark of the
  // nails...I will never believe").
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 2", `UPDATE people.description for thomas (id: ${thomasId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Apostle whose Aramaic name Thomas and Greek name Didymus both mean 'twin.' When Jesus said he would go to Lazarus despite danger, Thomas said 'Let us also go, that we may die with him.' At the Last Supper, objected that the disciples did not know where Jesus was going. After the resurrection, was absent when Jesus first appeared and refused to believe: 'Unless I see in his hands the mark of the nails…I will never believe.' When Jesus appeared a week later, Thomas touched the wounds and confessed 'My Lord and my God!' — the highest confession in John's Gospel. Tradition holds he founded the church in India and was martyred there.",
      thomasId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 3: nicodemus.description (scripts/seed-nt-ministry.ts line 180)
  // drops the opening "Rabbi," from his John 3:2 quotation.
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 3", `UPDATE people.description for nicodemus (id: ${nicodemusId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Pharisee and member of the Jewish ruling council (Sanhedrin). Came to Jesus by night, acknowledging 'Rabbi, we know that you are a teacher come from God.' Jesus told him 'You must be born again' and explained the famous verse 'For God so loved the world that he gave his only Son' (John 3:16). Later defended Jesus at a Sanhedrin meeting: 'Does our law judge a man without first giving him a hearing?' After the crucifixion, came with Joseph of Arimathea to prepare Jesus's body, bringing 75 pounds of myrrh and aloes.",
      nicodemusId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 4: martha.description (scripts/seed-nt-ministry.ts line 169)
  // drops the opening "Yes, Lord;" from her John 11:27 confession.
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 4", `UPDATE people.description for martha (id: ${marthaId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Sister of Mary and Lazarus from Bethany, close friend of Jesus. Received Jesus into her home while Mary sat at his feet; complained she was doing all the work alone. When Lazarus died, was the first to meet Jesus on the road and made the great confession: 'Yes, Lord; I believe that you are the Christ, the Son of God, who is coming into the world.' Then brought Mary to Jesus. Served at the dinner after Lazarus's resurrection while Mary anointed Jesus's feet.",
      marthaId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 5: mary_magdalene.description (scripts/seed-nt-ministry.ts line
  // 159) drops "to the Father" from John 20:17, changing what Jesus says
  // he has not yet done.
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 5", `UPDATE people.description for mary_magdalene (id: ${maryMagdaleneId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "From Magdala on the western shore of the Sea of Galilee. Jesus had cast seven demons from her. She followed Jesus from Galilee and supported his ministry. Present at the crucifixion and burial. First witness of the resurrection: went to the tomb early Sunday morning, found it empty, encountered the risen Jesus in the garden. She initially mistook him for the gardener; when Jesus said her name she recognized him and he said 'Do not cling to me, for I have not yet ascended to the Father.' Sent by Jesus to tell the disciples he had risen — the first apostle (one sent) of the resurrection, sometimes called 'Apostle to the Apostles.'",
      maryMagdaleneId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 6: mary_bethany.description (scripts/seed-nt-ministry.ts line
  // 164) quotes John 12:7 as "for my burial," but the ESV's actual wording
  // is "for the day of my burial."
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 6", `UPDATE people.description for mary_bethany (id: ${maryBethanyId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Sister of Martha and Lazarus, from Bethany. Chose to sit at Jesus's feet listening while Martha prepared the meal; Jesus defended her choice: 'Mary has chosen the good portion, which will not be taken away from her.' Anointed Jesus's feet with a pound of pure nard worth three hundred denarii and wiped them with her hair — an act of extravagant devotion Jesus said was done 'for the day of my burial.' The fragrance filled the house. Some traditions conflate her with Mary Magdalene but the Gospels present them as distinct.",
      maryBethanyId,
    ],
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finding 7: jairus.description (scripts/seed-nt-ministry.ts line 190)
  // translates "Talitha cumi" as "Little girl, get up," but the ESV's own
  // translation in Mark 5:41 is "Little girl, I say to you, arise."
  // ───────────────────────────────────────────────────────────────────────

  await run("Finding 7", `UPDATE people.description for jairus (id: ${jairusId})`, {
    sql: `UPDATE people SET description = ? WHERE id = ?`,
    args: [
      "Ruler of the synagogue in Capernaum. Fell at Jesus's feet and pleaded for his twelve-year-old daughter who was dying. While Jesus was on his way, she died and messengers told Jairus not to trouble the teacher. Jesus said 'Do not fear; only believe.' Took Peter, James, and John to the house; silenced the mourners who laughed when he said the child was sleeping; took her hand and said 'Talitha cumi' (Little girl, I say to you, arise). She rose immediately. Jesus instructed them to give her something to eat and told no one.",
      jairusId,
    ],
  });

  console.log(`\n${DRY_RUN ? "[DRY RUN] Would execute" : "Executed"} ${plannedStatements.length} statements.`);
  const counts = { insert: 0, update: 0, delete: 0, other: 0 };
  for (const p of plannedStatements) {
    const sql = p.stmt.sql.trim().toUpperCase();
    if (sql.startsWith("INSERT")) counts.insert++;
    else if (sql.startsWith("UPDATE")) counts.update++;
    else if (sql.startsWith("DELETE")) counts.delete++;
    else counts.other++;
  }
  console.log(`  INSERTs: ${counts.insert}`);
  console.log(`  UPDATEs: ${counts.update}`);
  console.log(`  DELETEs: ${counts.delete}`);
  if (counts.other) console.log(`  Other:   ${counts.other}`);

  if (!DRY_RUN) {
    process.exit(0);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
