import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN ?? process.env.TURSO_DATABASE_TURSO_AUTH_TOKEN,
});

const DRY_RUN = process.argv.includes("--dry-run");

async function resolveExisting(name: string, alsoKnownAs?: string): Promise<string> {
  const row = alsoKnownAs
    ? await db.execute({
        sql: "SELECT id FROM people WHERE name = ? AND also_known_as = ? LIMIT 1",
        args: [name, alsoKnownAs],
      })
    : await db.execute({
        sql: "SELECT id FROM people WHERE name = ? LIMIT 1",
        args: [name],
      });
  const r = row.rows[0] as unknown as { id: string } | undefined;
  if (!r) {
    throw new Error(`resolveExisting: could not find person name="${name}" aka="${alsoKnownAs ?? ""}" — aborting`);
  }
  return r.id;
}

async function resolveRelationship(aId: string, type: string, bId: string): Promise<string> {
  const row = await db.execute({
    sql: "SELECT id FROM relationships WHERE person_a_id = ? AND type = ? AND person_b_id = ?",
    args: [aId, type, bId],
  });
  if (row.rows.length === 0) {
    throw new Error(`resolveRelationship: no relationship found for (${aId}, ${type}, ${bId})`);
  }
  if (row.rows.length > 1) {
    throw new Error(`resolveRelationship: ${row.rows.length} relationships found for (${aId}, ${type}, ${bId}) — ambiguous`);
  }
  return (row.rows[0] as unknown as { id: string }).id;
}

async function updateRelationshipType(relId: string, newType: string, label: string) {
  console.log(`\n[${label}] UPDATE relationships.type -> "${newType}" (id: ${relId})`);
  if (DRY_RUN) return;
  await db.execute({
    sql: `UPDATE relationships SET type = ? WHERE id = ?`,
    args: [newType, relId],
  });
}

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN — no statements will be executed ===" : "=== LIVE RUN — mutating database ===");

  const jacobId = await resolveExisting("Jacob", "Israel");
  const manassehId = await resolveExisting("Manasseh", "Manasseh son of Joseph");
  const ephraimId = await resolveExisting("Ephraim");

  // Change type from parent_of -> other. This was added by the Genesis audit
  // (Finding S5, Gen 48:5's adoption) as a second parent_of edge alongside
  // Joseph's existing biological parent_of edge, creating a dual-male-parent
  // structural ambiguity buildLayout/buildForest's Pass 1 can't resolve
  // deterministically. "other" is an existing RelationshipType already
  // rendered by the detail panel (with its label/color), but not read by
  // any tree-structure logic (only parent_of is), so this preserves the
  // Gen 48:5 fact as fully visible while removing the structural conflict.
  // Joseph reverts to being Manasseh/Ephraim's sole tree-structural parent.
  const manassehRelId = await resolveRelationship(jacobId, "parent_of", manassehId);
  await updateRelationshipType(manassehRelId, "other", "jacob->manasseh");

  const ephraimRelId = await resolveRelationship(jacobId, "parent_of", ephraimId);
  await updateRelationshipType(ephraimRelId, "other", "jacob->ephraim");

  console.log(`\n${DRY_RUN ? "[DRY RUN] Would update" : "Updated"} 2 relationships.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
