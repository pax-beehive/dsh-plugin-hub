import { DatabaseSync } from "node:sqlite";
import { readFile, readdir } from "node:fs/promises";

class SqliteD1Statement {
  private readonly database: DatabaseSync;
  private readonly query: string;
  private readonly parameters: unknown[];

  constructor(
    database: DatabaseSync,
    query: string,
    parameters: unknown[] = [],
  ) {
    this.database = database;
    this.query = query;
    this.parameters = parameters;
  }

  bind(...parameters: unknown[]) {
    return new SqliteD1Statement(this.database, this.query, parameters);
  }

  async run() {
    const result = this.database.prepare(this.query).run(...this.parameters);
    return {
      success: true,
      results: [],
      meta: { changes: Number(result.changes) },
    };
  }

  async all() {
    return {
      success: true,
      results: this.database.prepare(this.query).all(...this.parameters),
      meta: {},
    };
  }

  async raw() {
    const rows = this.database.prepare(this.query).all(...this.parameters);
    return rows.map((row) => Object.values(row));
  }
}

export class SqliteD1Database {
  private readonly database: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.database = database;
  }

  prepare(query: string) {
    return new SqliteD1Statement(this.database, query);
  }

  async batch(statements: SqliteD1Statement[]) {
    return Promise.all(statements.map((statement) => statement.all()));
  }
}

export async function createTestD1() {
  const sqlite = new DatabaseSync(":memory:");
  const migrationDirectory = new URL("../../drizzle/", import.meta.url);
  const migrationFiles = (await readdir(migrationDirectory))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  for (const migrationFile of migrationFiles) {
    const sql = await readFile(new URL(migrationFile, migrationDirectory), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim()) sqlite.exec(statement);
    }
  }

  return {
    sqlite,
    binding: new SqliteD1Database(sqlite) as unknown as D1Database,
  };
}
