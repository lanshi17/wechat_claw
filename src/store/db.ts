import Database from "better-sqlite3";
import { applyMigrations } from "./migrations.js";

export function createInMemoryDatabase() {
  const db = new Database(":memory:");
  applyMigrations(db);
  return db;
}

export function createSqliteDatabase(databasePath: string) {
  const db = new Database(databasePath);
  applyMigrations(db);
  return db;
}
