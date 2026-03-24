export type ThreadRecord = {
  id: string;
  sourceUserId: string;
  title: string;
};

export type ThreadEventRecord = {
  id: string;
  threadId: string;
  kind: string;
  summary: string;
};

export function applyMigrations(db: import("better-sqlite3").Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS threads (
      id TEXT PRIMARY KEY,
      source_user_id TEXT NOT NULL,
      title TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_events (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      summary TEXT NOT NULL,
      FOREIGN KEY(thread_id) REFERENCES threads(id)
    );
  `);
}
