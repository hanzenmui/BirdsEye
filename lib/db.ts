import { createClient } from "@libsql/client";
import { schema, MIGRATIONS } from "./schema";

type Params = (string | number | boolean | null)[];

export interface DbExecutor {
  query<T = Record<string, unknown>>(sql: string, params?: Params): Promise<T[]>;
  run(sql: string, params?: Params): Promise<void>;
}

interface DbClient extends DbExecutor {
  batch(statements: { sql: string; params?: Params }[]): Promise<void>;
  transaction<T>(fn: (tx: DbExecutor) => Promise<T>): Promise<T>;
  init(): Promise<void>;
}

function bind(sql: string, params: Params) {
  const args: Params = [];
  const query = sql.replace(/\$(\d+)/g, (_, index: string) => {
    args.push(params[Number(index) - 1]);
    return "?";
  });
  return { sql: query, args: args.length ? args : params };
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
  // Keep unrelated requests out of an interactive SQLite transaction, including
  // reads: otherwise one request could observe another's uncommitted changes.
  let queue = Promise.resolve();
  function serialized<T>(fn: () => Promise<T>): Promise<T> {
    const result = queue.then(fn);
    queue = result.then(() => undefined, () => undefined);
    return result;
  }
  const executor: DbExecutor = {
    async query<T>(sql: string, params: Params = []) {
      const bound = bind(sql, params);
      return db.prepare(bound.sql).all(bound.args) as T[];
    },
    async run(sql: string, params: Params = []) {
      const bound = bind(sql, params);
      db.prepare(bound.sql).run(bound.args);
    },
  };
  return {
    async query<T>(sql: string, params: Params = []) {
      return serialized(() => executor.query<T>(sql, params));
    },
    async run(sql: string, params: Params = []) {
      return serialized(() => executor.run(sql, params));
    },
    async batch(statements) {
      const tx = db.transaction(() => {
        for (const { sql, params = [] } of statements) {
          const bound = bind(sql, params);
          db.prepare(bound.sql).run(bound.args);
        }
      });
      await serialized(async () => { tx(); });
    },
    async transaction<T>(fn: (tx: DbExecutor) => Promise<T>) {
      return serialized(async () => {
        db.exec("BEGIN IMMEDIATE");
        try {
          const result = await fn(executor);
          db.exec("COMMIT");
          return result;
        } catch (error) {
          db.exec("ROLLBACK");
          throw error;
        }
      });
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
      const res = await client.execute(bind(sql, params));
      return res.rows as unknown as T[];
    },
    async run(sql: string, params: Params = []) {
      await client.execute(bind(sql, params));
    },
    async batch(statements) {
      await client.batch(statements.map(s => bind(s.sql, s.params ?? [])), "write");
    },
    async transaction<T>(fn: (tx: DbExecutor) => Promise<T>) {
      const tx = await client.transaction("write");
      try {
        const result = await fn({
          async query<R>(sql: string, params: Params = []) {
            const res = await tx.execute(bind(sql, params));
            return res.rows as unknown as R[];
          },
          async run(sql: string, params: Params = []) {
            await tx.execute(bind(sql, params));
          },
        });
        await tx.commit();
        return result;
      } finally {
        tx.close();
      }
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
    shared.__birdseyeDbInit = shared.__birdseyeDb.init();
    void shared.__birdseyeDbInit.catch(console.error);
  }
  return shared.__birdseyeDb;
}

export async function getReadyDb(): Promise<DbClient> {
  const db = getDb();
  await shared.__birdseyeDbInit;
  return db;
}
