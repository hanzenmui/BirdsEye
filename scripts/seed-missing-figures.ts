// Seventeen named figures found missing by a cross-check of the data against
// Thiele's chronology and the text. Several already appeared inside other
// people's descriptions — Hazael in Joram's, Necho in Josiah's, Shalmaneser in
// Hoshea's — so the app knew of them but they could not be looked up.
//
// Every person, reference and relationship below was checked against the text.
// Same-name traps avoided:
//   - Amasa's mother is Abigail, David's SISTER (2 Samuel 17:25). The Abigail in
//     this database is Nabal's widow, David's wife. No link is made.
//   - Barzillai the Gileadite (2 Samuel 19) is not Barzillai the Meholathite,
//     father of Adriel (2 Samuel 21:8).
//   - Jonadab son of Shimeah (2 Samuel 13:3) is not Jehonadab son of Rechab
//     (Jeremiah 35).
//   - Zechariah is the son of Berechiah, GRANDSON of Iddo (Zechariah 1:1), so
//     Iddo is linked as ancestor rather than parent. Berechiah is not in the
//     database.
//
// Tibni is deliberately left off the timeline. He was a rival claimant during a
// four-year civil war, not a sole ruler, and the Israel lane is single-row —
// giving him dates would draw him overlapping Omri as though both reigned
// alone. He is a full person record everywhere else.
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

type P = {
  name: string; aka: string; gender: "male" | "female"; testament: "OT" | "NT";
  description: string; tags: string[];
  refs: { book: string; cs: number; vs: number; ce: number; ve: number; note: string }[];
};

const PEOPLE: P[] = [
  { name: "Tibni", aka: "Tibni son of Ginath", gender: "male", testament: "OT",
    description: "Rival claimant to the throne of Israel after Zimri's death. The nation split in two, half supporting Tibni and half supporting Omri, and the two factions fought for about four years until Omri's followers proved stronger and Tibni died (1 Kings 16:21-22). Counted among the kings of Israel in standard chronologies, usually c. 885-880 BC.",
    tags: ["king"],
    refs: [{ book: "1 Kings", cs: 16, vs: 21, ce: 16, ve: 22, note: "Half of Israel supported him for king against Omri." }] },

  { name: "Hazael", aka: "Hazael king of Aram", gender: "male", testament: "OT",
    description: "King of Aram whom Elijah was told to anoint (1 Kings 19:15). An official of Ben-Hadad, he was told by Elisha that he would be king, then smothered his master with a wet cloth the next day and took the throne. He struck Israel repeatedly for decades, took Gath, and was bought off from Jerusalem with the temple treasures by Joash of Judah.",
    tags: ["king", "antagonist"],
    refs: [
      { book: "1 Kings", cs: 19, vs: 15, ce: 19, ve: 17, note: "Elijah told to anoint him king over Aram." },
      { book: "2 Kings", cs: 8, vs: 7, ce: 8, ve: 15, note: "Smothered Ben-Hadad and succeeded him." },
      { book: "2 Kings", cs: 13, vs: 3, ce: 13, ve: 7, note: "Oppressed Israel throughout Jehoahaz's reign." },
    ] },

  { name: "Micaiah", aka: "Micaiah son of Imlah", gender: "male", testament: "OT",
    description: "Prophet whom Ahab hated because he never prophesied anything good about him. Summoned at Jehoshaphat's insistence when four hundred prophets had promised victory, he foretold Israel scattered on the hills like sheep without a shepherd. Struck by Zedekiah son of Kenaanah and jailed on bread and water; Ahab died in the battle exactly as he had said.",
    tags: ["prophet"],
    refs: [
      { book: "1 Kings", cs: 22, vs: 8, ce: 22, ve: 28, note: "Foretold Ahab's death against four hundred prophets." },
      { book: "2 Chronicles", cs: 18, vs: 7, ce: 18, ve: 27, note: "The same confrontation retold." },
    ] },

  { name: "Necho", aka: "Pharaoh Necho II, Neco king of Egypt", gender: "male", testament: "OT",
    description: "Pharaoh of Egypt who marched to the Euphrates to support Assyria. Josiah went out to meet him in battle and was killed at Megiddo. Necho then deposed Jehoahaz after three months, took him to Egypt, set Eliakim on the throne as Jehoiakim, and imposed tribute on Judah.",
    tags: ["king", "egyptian"],
    refs: [
      { book: "2 Kings", cs: 23, vs: 29, ce: 23, ve: 35, note: "Killed Josiah at Megiddo; installed Jehoiakim." },
      { book: "2 Chronicles", cs: 35, vs: 20, ce: 35, ve: 24, note: "Warned Josiah not to fight him." },
    ] },

  { name: "Nebuzaradan", aka: "Nebuzaradan commander of the imperial guard", gender: "male", testament: "OT",
    description: "Commander of Nebuchadnezzar's imperial guard who carried out the destruction of Jerusalem. He burned the temple, the palace and every important building, broke down the city walls, and deported the people, leaving only the poorest to work the vineyards and fields. He was ordered to treat Jeremiah well and set him free.",
    tags: ["antagonist"],
    refs: [
      { book: "2 Kings", cs: 25, vs: 8, ce: 25, ve: 21, note: "Burned the temple and deported Judah." },
      { book: "Jeremiah", cs: 39, vs: 9, ce: 39, ve: 14, note: "Ordered to look after Jeremiah." },
    ] },

  { name: "Shalmaneser", aka: "Shalmaneser V king of Assyria", gender: "male", testament: "OT",
    description: "King of Assyria to whom Hoshea of Israel was a vassal. When Hoshea stopped paying tribute and sought help from Egypt, Shalmaneser imprisoned him and laid siege to Samaria. The siege lasted three years and ended the northern kingdom.",
    tags: ["king", "antagonist"],
    refs: [
      { book: "2 Kings", cs: 17, vs: 3, ce: 17, ve: 6, note: "Besieged Samaria for three years." },
      { book: "2 Kings", cs: 18, vs: 9, ce: 18, ve: 11, note: "The siege dated to Hezekiah's fourth year." },
    ] },

  { name: "Merodach-Baladan", aka: "Merodach-Baladan son of Baladan, Marduk-Baladan king of Babylon", gender: "male", testament: "OT",
    description: "King of Babylon who sent letters and a gift to Hezekiah after hearing of his illness. Hezekiah showed the envoys everything in his treasury, and Isaiah told him that all of it, and his own descendants, would one day be carried off to Babylon.",
    tags: ["king"],
    refs: [
      { book: "2 Kings", cs: 20, vs: 12, ce: 20, ve: 19, note: "Sent envoys to Hezekiah, who showed them the treasury." },
      { book: "Isaiah", cs: 39, vs: 1, ce: 39, ve: 8, note: "The same visit and Isaiah's warning." },
    ] },

  { name: "Amasa", aka: "Amasa son of Jether", gender: "male", testament: "OT",
    description: "Commander of Absalom's army, appointed in place of Joab. Son of Jether the Ishmaelite and Abigail, David's sister — not Abigail the wife of David. After the revolt David offered him Joab's command, but Joab took him by the beard as if to kiss him and stabbed him in the belly while pursuing Sheba's rebellion.",
    tags: ["leader", "warrior"],
    refs: [
      { book: "2 Samuel", cs: 17, vs: 25, ce: 17, ve: 25, note: "Set over Absalom's army in place of Joab." },
      { book: "2 Samuel", cs: 20, vs: 4, ce: 20, ve: 12, note: "Murdered by Joab on the road at Gibeon." },
    ] },

  { name: "Ziba", aka: "Ziba servant of Saul's household", gender: "male", testament: "OT",
    description: "Steward of Saul's household, summoned by David when he asked whether anyone of Saul's family remained. He named Mephibosheth and was made to farm the land for him. During Absalom's revolt he met David with supplies and said Mephibosheth had stayed behind hoping for the throne; on David's return Mephibosheth denied it, and David divided the land between them.",
    tags: ["servant"],
    refs: [
      { book: "2 Samuel", cs: 9, vs: 2, ce: 9, ve: 13, note: "Named Mephibosheth and was made to farm for him." },
      { book: "2 Samuel", cs: 16, vs: 1, ce: 16, ve: 4, note: "Brought supplies to David and accused Mephibosheth." },
      { book: "2 Samuel", cs: 19, vs: 24, ce: 19, ve: 30, note: "The land divided between him and Mephibosheth." },
    ] },

  { name: "Jonadab", aka: "Jonadab son of Shimeah, David's nephew", gender: "male", testament: "OT",
    description: "A very shrewd man, son of David's brother Shimeah and friend of Amnon. He devised the plan by which Amnon feigned illness and had Tamar sent to him. Later, when word came that Absalom had killed all the king's sons, it was Jonadab who told David that only Amnon was dead. Not the same man as Jehonadab son of Rechab in Jeremiah 35.",
    tags: ["other"],
    refs: [
      { book: "2 Samuel", cs: 13, vs: 3, ce: 13, ve: 5, note: "Devised the plan that led to Tamar's rape." },
      { book: "2 Samuel", cs: 13, vs: 32, ce: 13, ve: 35, note: "Told David only Amnon was dead." },
    ] },

  { name: "Rizpah", aka: "Rizpah daughter of Aiah", gender: "female", testament: "OT",
    description: "Concubine of Saul and daughter of Aiah. Abner's taking of her provoked his break with Ish-bosheth. When her two sons were handed over to the Gibeonites and killed, she spread sackcloth on a rock and kept watch over the bodies from harvest until the rains came, driving off birds by day and wild animals by night, until David heard and had the bones buried.",
    tags: ["other"],
    refs: [
      { book: "2 Samuel", cs: 3, vs: 7, ce: 3, ve: 11, note: "Abner's taking of her provoked the break with Ish-bosheth." },
      { book: "2 Samuel", cs: 21, vs: 8, ce: 21, ve: 14, note: "Kept vigil over her sons' bodies until the rains." },
    ] },

  { name: "Barzillai", aka: "Barzillai the Gileadite of Rogelim", gender: "male", testament: "OT",
    description: "Wealthy Gileadite from Rogelim who provided for David at Mahanaim during Absalom's revolt. He came down to see the king across the Jordan but declined the invitation to Jerusalem, saying that at eighty he could no longer taste what he ate or hear singers, and sent Kimham in his place. Not the same man as Barzillai the Meholathite, father of Adriel.",
    tags: ["other"],
    refs: [
      { book: "2 Samuel", cs: 17, vs: 27, ce: 17, ve: 29, note: "Supplied David's company at Mahanaim." },
      { book: "2 Samuel", cs: 19, vs: 31, ce: 19, ve: 39, note: "Declined Jerusalem at eighty and sent Kimham." },
    ] },

  { name: "Iddo", aka: "Iddo the seer, grandfather of Zechariah", gender: "male", testament: "OT",
    description: "Seer whose records are cited as sources for the reigns of Solomon, Rehoboam and Abijah. Grandfather of the prophet Zechariah, who is called son of Berechiah, son of Iddo.",
    tags: ["prophet"],
    refs: [
      { book: "2 Chronicles", cs: 9, vs: 29, ce: 9, ve: 29, note: "His visions cited as a record of Solomon's reign." },
      { book: "Zechariah", cs: 1, vs: 1, ce: 1, ve: 1, note: "Named as the prophet Zechariah's grandfather." },
    ] },

  { name: "Bartimaeus", aka: "Bartimaeus son of Timaeus", gender: "male", testament: "NT",
    description: "Blind beggar sitting by the roadside as Jesus left Jericho. He shouted 'Son of David, have mercy on me' and shouted louder when the crowd told him to be quiet. Called over, he threw his cloak aside and asked to see; Jesus told him his faith had healed him, and he followed along the road. One of the few people Jesus healed whose name is recorded.",
    tags: ["other"],
    refs: [{ book: "Mark", cs: 10, vs: 46, ce: 10, ve: 52, note: "Called out to Jesus and received his sight." }] },

  { name: "Joanna", aka: "Joanna wife of Chuza", gender: "female", testament: "NT",
    description: "Wife of Chuza, the manager of Herod's household. One of the women who had been cured of illnesses and who supported Jesus and the disciples out of their own means. She was among those who came to the tomb, found it empty, and told the apostles.",
    tags: ["other"],
    refs: [
      { book: "Luke", cs: 8, vs: 3, ce: 8, ve: 3, note: "Supported Jesus and the disciples from her own means." },
      { book: "Luke", cs: 24, vs: 10, ce: 24, ve: 10, note: "Among the women who reported the empty tomb." },
    ] },

  { name: "Bernice", aka: "Bernice sister of Herod Agrippa II", gender: "female", testament: "NT",
    description: "Sister of Herod Agrippa II, with whom she arrived at Caesarea to pay respects to Festus. She sat with her brother in great pomp as Paul made his defence, and left the room with him afterwards when they agreed Paul had done nothing deserving death.",
    tags: ["royalty"],
    refs: [{ book: "Acts", cs: 25, vs: 13, ce: 26, ve: 32, note: "Present with Agrippa II for Paul's defence at Caesarea." }] },

  { name: "Drusilla", aka: "Drusilla wife of Felix", gender: "female", testament: "NT",
    description: "Jewish wife of the governor Felix. She was with him when he sent for Paul and listened to him speak about faith in Christ Jesus; as Paul spoke of righteousness, self-control and the judgment to come, Felix grew afraid and sent him away.",
    tags: ["royalty"],
    refs: [{ book: "Acts", cs: 24, vs: 24, ce: 24, ve: 27, note: "Heard Paul with Felix, who became afraid." }] },
];

// Only links the text states plainly, between people who exist.
const RELS: { a: [string, string]; type: string; b: [string, string]; notes: string }[] = [
  { a: ["Omri", "Omri king of Israel"], type: "enemy_of", b: ["Tibni", "Tibni son of Ginath"],
    notes: "Israel split between them; Omri's followers proved stronger and Tibni died (1 Kings 16:21-22)." },
  { a: ["Joab", ""], type: "enemy_of", b: ["Amasa", "Amasa son of Jether"],
    notes: "Took Amasa by the beard as if to kiss him and stabbed him (2 Samuel 20:9-10)." },
  { a: ["Absalom", ""], type: "ruler_of", b: ["Amasa", "Amasa son of Jether"],
    notes: "Appointed Amasa over his army in place of Joab (2 Samuel 17:25)." },
  { a: ["Ziba", "Ziba servant of Saul's household"], type: "servant_of", b: ["Saul", ""],
    notes: "Steward of Saul's household (2 Samuel 9:2)." },
  { a: ["Jonadab", "Jonadab son of Shimeah, David's nephew"], type: "ally_of", b: ["Amnon", ""],
    notes: "Amnon's friend and adviser; devised the plan against Tamar (2 Samuel 13:3-5)." },
  { a: ["Rizpah", "Rizpah daughter of Aiah"], type: "spouse_of", b: ["Saul", ""],
    notes: "Saul's concubine (2 Samuel 3:7, 21:8)." },
  { a: ["Barzillai", "Barzillai the Gileadite of Rogelim"], type: "ally_of", b: ["David", ""],
    notes: "Provided for David at Mahanaim during Absalom's revolt (2 Samuel 17:27-29)." },
  { a: ["Micaiah", "Micaiah son of Imlah"], type: "enemy_of", b: ["Ahab", ""],
    notes: "Ahab hated him because he never prophesied anything good about him (1 Kings 22:8)." },
  { a: ["Elisha", ""], type: "other", b: ["Hazael", "Hazael king of Aram"],
    notes: "Told Hazael he would be king over Aram, and wept for what he would do to Israel (2 Kings 8:11-13)." },
  { a: ["Necho", "Pharaoh Necho II, Neco king of Egypt"], type: "enemy_of", b: ["Josiah", ""],
    notes: "Killed Josiah at Megiddo (2 Kings 23:29)." },
  { a: ["Nebuzaradan", "Nebuzaradan commander of the imperial guard"], type: "servant_of", b: ["Nebuchadnezzar", "Nebuchadnezzar king of Babylon"],
    notes: "Commander of his imperial guard (2 Kings 25:8)." },
  { a: ["Shalmaneser", "Shalmaneser V king of Assyria"], type: "enemy_of", b: ["Hoshea", "Hoshea king of Israel"],
    notes: "Imprisoned Hoshea and besieged Samaria for three years (2 Kings 17:3-6)." },
  { a: ["Merodach-Baladan", "Merodach-Baladan son of Baladan, Marduk-Baladan king of Babylon"], type: "ally_of", b: ["Hezekiah", ""],
    notes: "Sent letters and a gift after hearing of Hezekiah's illness (2 Kings 20:12)." },
  { a: ["Iddo", "Iddo the seer, grandfather of Zechariah"], type: "ancestor_of", b: ["Zechariah", "Zechariah son of Berechiah"],
    notes: "Zechariah is son of Berechiah, son of Iddo (Zechariah 1:1). Berechiah is not recorded here." },
  { a: ["Bernice", "Bernice sister of Herod Agrippa II"], type: "sibling_of", b: ["Herod Agrippa II", "Herod Agrippa II, king Agrippa"],
    notes: "Arrived with her brother at Caesarea (Acts 25:13)." },
  { a: ["Drusilla", "Drusilla wife of Felix"], type: "spouse_of", b: ["Felix", "Antonius Felix, governor of Judea"],
    notes: "Felix came with his wife Drusilla, who was Jewish (Acts 24:24)." },
];

async function resolve(name: string, aka: string): Promise<{ id: string; name: string }> {
  const r = await db.execute({
    sql: "SELECT id,name FROM people WHERE name = ? AND also_known_as = ?",
    args: [name, aka],
  });
  if (r.rows.length === 1) return r.rows[0] as unknown as { id: string; name: string };
  throw new Error(`Refusing to guess: "${name}" (aka "${aka}") matched ${r.rows.length} rows.`);
}

async function main() {
  console.log(DRY_RUN ? "DRY RUN — nothing will be written\n" : "");

  console.log("People...");
  for (const p of PEOPLE) {
    const existing = await db.execute({
      sql: "SELECT id FROM people WHERE name = ? AND also_known_as = ?", args: [p.name, p.aka],
    });
    if (existing.rows.length) { console.log(`  exists: ${p.name}`); continue; }
    console.log(`  ${DRY_RUN ? "would add" : "adding"}: ${p.name} (${p.aka})`);
    if (!DRY_RUN) {
      await db.execute({
        sql: `INSERT INTO people (id,name,also_known_as,gender,testament,birth_year,death_year,description,tags,created_at)
              VALUES (?,?,?,?,?,'','',?,?,datetime('now'))`,
        args: [crypto.randomUUID(), p.name, p.aka, p.gender, p.testament, p.description, JSON.stringify(p.tags)],
      });
    }
  }

  console.log("\nScripture references...");
  let refCount = 0;
  for (const p of PEOPLE) {
    let id: string;
    try { id = (await resolve(p.name, p.aka)).id; }
    catch { if (DRY_RUN) { console.log(`  (dry run) ${p.name}: ${p.refs.length} ref(s) once the person exists`); continue; } throw new Error(`missing ${p.name}`); }
    for (const r of p.refs) {
      const dup = await db.execute({
        sql: `SELECT id FROM scripture_refs WHERE person_id=? AND book=? AND chapter_start=? AND verse_start=?`,
        args: [id, r.book, r.cs, r.vs],
      });
      if (dup.rows.length) { console.log(`  exists: ${p.name} -> ${r.book} ${r.cs}:${r.vs}`); continue; }
      console.log(`  ${DRY_RUN ? "would tag" : "tagging"}: ${p.name} -> ${r.book} ${r.cs}:${r.vs}-${r.ve}`);
      if (!DRY_RUN) {
        await db.execute({
          sql: `INSERT INTO scripture_refs (id,person_id,event_id,book,chapter_start,verse_start,chapter_end,verse_end,note,created_at)
                VALUES (?,?,'',?,?,?,?,?,?,datetime('now'))`,
          args: [crypto.randomUUID(), id, r.book, r.cs, r.vs, r.ce, r.ve, r.note],
        });
        refCount++;
      }
    }
  }

  console.log("\nRelationships...");
  let relCount = 0;
  for (const l of RELS) {
    let a, b;
    try { a = await resolve(l.a[0], l.a[1]); b = await resolve(l.b[0], l.b[1]); }
    catch (e) { if (DRY_RUN) { console.log(`  (dry run) would link ${l.a[0]} ${l.type} ${l.b[0]} once both exist`); continue; } throw e; }
    const dup = await db.execute({
      sql: `SELECT id FROM relationships WHERE person_a_id=? AND type=? AND person_b_id=?`,
      args: [a.id, l.type, b.id],
    });
    if (dup.rows.length) { console.log(`  exists: ${a.name} ${l.type} ${b.name}`); continue; }
    console.log(`  ${DRY_RUN ? "would add" : "adding"}: ${a.name} ${l.type} ${b.name}`);
    if (!DRY_RUN) {
      await db.execute({
        sql: `INSERT OR IGNORE INTO relationships (id,person_a_id,person_a_name,type,person_b_id,person_b_name,notes,created_at)
              VALUES (?,?,?,?,?,?,?,datetime('now'))`,
        args: [crypto.randomUUID(), a.id, a.name, l.type, b.id, b.name, l.notes],
      });
      relCount++;
    }
  }
  console.log(`\nDone.${DRY_RUN ? "" : ` ${PEOPLE.length} people checked, ${refCount} reference(s), ${relCount} relationship(s) added.`}`);
}

main();
