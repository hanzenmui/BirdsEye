import { getReadyDb, type DbExecutor } from "./db";
import { ApiError } from "./auth";

export const LIBRARY_TABLES = ["people", "relationships", "scripture_refs", "historical_events", "prophecy_links", "traditions", "tradition_edges", "tradition_people"] as const;
type Table = typeof LIBRARY_TABLES[number];
type Row = Record<string, string | number | null>;
type Snapshot = Partial<Record<Table, Row[]>>;

export async function archiveRecord(kind: "person" | "reference" | "relationship", id: string) {
  const db = await getReadyDb();
  return db.transaction(async tx => {
    const table = kind === "person" ? "people" : kind === "reference" ? "scripture_refs" : "relationships";
    const [record] = await tx.query<Row>(`SELECT * FROM ${table} WHERE id=$1`, [id]);
    if (!record) throw new ApiError("This record no longer exists.", 404);
    const snapshot: Snapshot = { [table]: [record] };
    if (kind === "person") {
      snapshot.scripture_refs = await tx.query("SELECT * FROM scripture_refs WHERE person_id=$1", [id]);
      snapshot.relationships = await tx.query("SELECT * FROM relationships WHERE person_a_id=$1 OR person_b_id=$2", [id, id]);
      snapshot.prophecy_links = await tx.query("SELECT * FROM prophecy_links WHERE prophet_person_id=$1", [id]);
      snapshot.tradition_people = await tx.query("SELECT * FROM tradition_people WHERE person_id=$1", [id]);
    }
    const label = kind === "person" ? String(record.name)
      : kind === "reference" ? `${record.book} ${record.chapter_start}:${record.verse_start}`
      : `${record.person_a_name} — ${String(record.type).replaceAll("_", " ")} — ${record.person_b_name}`;
    const recoveryId = crypto.randomUUID();
    await tx.run("INSERT INTO deleted_records (id,label,kind,snapshot,deleted_at) VALUES ($1,$2,$3,$4,$5)",
      [recoveryId, label, kind, JSON.stringify(snapshot), new Date().toISOString()]);
    for (const name of [...LIBRARY_TABLES].reverse()) {
      for (const row of snapshot[name] ?? []) await tx.run(`DELETE FROM ${name} WHERE id=$1`, [String(row.id)]);
    }
    return recoveryId;
  });
}

async function requirePerson(tx: DbExecutor, id: string) {
  if (!id || !(await tx.query("SELECT id FROM people WHERE id=$1", [id])).length) {
    throw new ApiError("A related person is missing. Restore that person first, then retry. Nothing was changed.", 409);
  }
}

export async function restoreRecord(id: string) {
  const db = await getReadyDb();
  return db.transaction(async tx => {
    const [deleted] = await tx.query<{ label: string; snapshot: string }>("SELECT label,snapshot FROM deleted_records WHERE id=$1", [id]);
    if (!deleted) throw new ApiError("This record was already restored or no longer exists.", 404);
    const snapshot: Snapshot = JSON.parse(deleted.snapshot);
    for (const table of LIBRARY_TABLES) {
      const columns = new Set((await tx.query<{ name: string }>(`PRAGMA table_info(${table})`)).map(c => c.name));
      for (const row of snapshot[table] ?? []) {
        if (table === "relationships") {
          await requirePerson(tx, String(row.person_a_id));
          await requirePerson(tx, String(row.person_b_id));
          row.person_a_name = (await tx.query<Row>("SELECT name FROM people WHERE id=$1", [String(row.person_a_id)]))[0].name;
          row.person_b_name = (await tx.query<Row>("SELECT name FROM people WHERE id=$1", [String(row.person_b_id)]))[0].name;
        } else if (table === "scripture_refs" && row.person_id) await requirePerson(tx, String(row.person_id));
        else if (table === "prophecy_links") await requirePerson(tx, String(row.prophet_person_id));
        else if (table === "tradition_people") await requirePerson(tx, String(row.person_id));
        const keys = Object.keys(row).filter(k => columns.has(k));
        try {
          await tx.run(`INSERT INTO ${table} (${keys.map(k => `"${k}"`).join(",")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(",")})`, keys.map(k => row[k]));
        } catch (error) {
          if (/UNIQUE constraint/i.test(String(error))) throw new ApiError("A matching record already exists. Nothing was overwritten or restored.", 409);
          throw error;
        }
      }
    }
    await tx.run("DELETE FROM deleted_records WHERE id=$1", [id]);
    return deleted.label;
  });
}

export async function exportLibrary() {
  const db = await getReadyDb();
  return db.transaction(async tx => {
    const tables: Snapshot = {};
    for (const name of LIBRARY_TABLES) tables[name] = await tx.query<Row>(`SELECT * FROM ${name}`);
    const deleted = await tx.query("SELECT * FROM deleted_records");
    return { format: "birdseye-library", version: 1, exportedAt: new Date().toISOString(), tables, deleted };
  });
}
