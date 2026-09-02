import { createClient } from "@libsql/client";
import { schema, MIGRATIONS } from "./schema";

type Params = (string | number | boolean | null)[];

interface DbClient {
  query<T = Record<string, unknown>>(sql: string, params?: Params): Promise<T[]>;
  run(sql: string, params?: Params): Promise<void>;
  batch(statements: { sql: string; params?: Params }[]): Promise<void>;
  init(): Promise<void>;
}

function toPositional(sql: string) {
  return sql.replace(/\$\d+/g, "?");
}

function addedColumn(sql: string) {
  const match = sql.match(/^\s*ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+(\w+)/i);
  return match ? { table: match[1], column: match[2] } : null;
}

function warnMigrationFailure(sql: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (sql.includes("idx_relationships_unique") && message.includes("UNIQUE constraint failed")) {
    console.warn("Relationship uniqueness index is pending because duplicate relationship rows still exist. Run the dedupe script before enabling it.");
    return;
  }
  console.warn("Migration skipped:", message);
}

function makeLocalDb(path: string): DbClient {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3");
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  return {
    async query<T>(sql: string, params: Params = []) {
      return db.prepare(toPositional(sql)).all(params) as T[];
    },
    async run(sql: string, params: Params = []) {
      db.prepare(toPositional(sql)).run(params);
    },
    async batch(statements) {
      const tx = db.transaction(() => {
        for (const { sql, params = [] } of statements) {
          db.prepare(toPositional(sql)).run(params);
        }
      });
      tx();
    },
    async init() {
      for (const s of schema) db.exec(s);
      for (const m of MIGRATIONS) {
        const target = addedColumn(m);
        if (target) {
          const columns = db.prepare(`PRAGMA table_info(${target.table})`).all() as { name: string }[];
          if (columns.some(column => column.name === target.column)) continue;
        }
        try { db.exec(m); } catch (error) { warnMigrationFailure(m, error); }
      }
    },
  };
}

function makeTursoDb(): DbClient {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN ?? process.env.TURSO_DATABASE_TURSO_AUTH_TOKEN,
  });
  return {
    async query<T>(sql: string, params: Params = []) {
      const res = await client.execute({ sql, args: params });
      return res.rows as unknown as T[];
    },
    async run(sql: string, params: Params = []) {
      await client.execute({ sql, args: params });
    },
    async batch(statements) {
      await client.batch(statements.map(s => ({ sql: s.sql, args: s.params ?? [] })));
    },
    async init() {
      for (const s of schema) await client.execute(s);
      for (const m of MIGRATIONS) {
        const target = addedColumn(m);
        if (target) {
          const columns = await client.execute(`PRAGMA table_info(${target.table})`);
          if (columns.rows.some(column => String(column.name) === target.column)) continue;
        }
        try { await client.execute(m); } catch (error) { warnMigrationFailure(m, error); }
      }
    },
  };
}

const shared = globalThis as typeof globalThis & {
  __birdseyeDb?: DbClient;
  __birdseyeDbInit?: Promise<void>;
};

export function getDb(): DbClient {
  if (!shared.__birdseyeDb) {
    const useTurso = process.env.DB_MODE === "turso" || !!process.env.TURSO_DATABASE_URL;
    shared.__birdseyeDb = useTurso
      ? makeTursoDb()
      : makeLocalDb(process.env.SQLITE_PATH ?? "./data/birdseye.db");
    shared.__birdseyeDbInit = shared.__birdseyeDb.init().catch(console.error);
  }
  return shared.__birdseyeDb;
}
