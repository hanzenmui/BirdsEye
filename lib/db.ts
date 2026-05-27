import Database from "better-sqlite3";
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

function makeLocalDb(path: string): DbClient {
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
        try { db.exec(m); } catch {}
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
        try { await client.execute(m); } catch {}
      }
    },
  };
}

let _db: DbClient | null = null;
export function getDb(): DbClient {
  if (!_db) {
    const useTurso = process.env.DB_MODE === "turso" || !!process.env.TURSO_DATABASE_URL;
    _db = useTurso
      ? makeTursoDb()
      : makeLocalDb(process.env.SQLITE_PATH ?? "./data/birdseye.db");
    _db.init().catch(console.error);
  }
  return _db;
}
