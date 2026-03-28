import type Database from "better-sqlite3";
import type { EventInput } from "./events.js";

export type ThreadInput = {
  sourceUserId: string;
  title: string;
};

export type ThreadRecord = {
  id: string;
  sourceUserId: string;
  title: string;
  status: string;
};

export type ThreadEventRecord = {
  id: string;
  threadId: string;
  kind: string;
  summary: string;
};

export class ThreadRepository {
  constructor(private readonly db: Database.Database) {}

  create(input: ThreadInput): ThreadRecord {
    const thread: ThreadRecord = {
      id: crypto.randomUUID(),
      sourceUserId: input.sourceUserId,
      title: input.title,
      status: "queued",
    };

    this.db
      .prepare("INSERT INTO threads (id, source_user_id, title, status) VALUES (?, ?, ?, ?)")
      .run(thread.id, thread.sourceUserId, thread.title, thread.status);

    return thread;
  }

  appendEvent(threadId: string, event: EventInput): ThreadEventRecord {
    const record: ThreadEventRecord = {
      id: crypto.randomUUID(),
      threadId,
      kind: event.kind,
      summary: event.summary,
    };

    this.db
      .prepare("INSERT INTO task_events (id, thread_id, kind, summary) VALUES (?, ?, ?, ?)")
      .run(record.id, record.threadId, record.kind, record.summary);

    return record;
  }

  get(threadId: string): ThreadRecord | undefined {
    const row = this.db
      .prepare("SELECT id, source_user_id, title, status FROM threads WHERE id = ?")
      .get(threadId) as { id: string; source_user_id: string; title: string; status: string } | undefined;

    if (!row) {
      return undefined;
    }

    return {
      id: row.id,
      sourceUserId: row.source_user_id,
      title: row.title,
      status: row.status,
    };
  }

  listEvents(threadId: string): ThreadEventRecord[] {
    const rows = this.db
      .prepare("SELECT id, thread_id, kind, summary FROM task_events WHERE thread_id = ? ORDER BY rowid ASC")
      .all(threadId) as Array<{ id: string; thread_id: string; kind: string; summary: string }>;

    return rows.map((row) => ({
      id: row.id,
      threadId: row.thread_id,
      kind: row.kind,
      summary: row.summary,
    }));
  }

  updateStatus(threadId: string, status: string): void {
    this.db
      .prepare("UPDATE threads SET status = ? WHERE id = ?")
      .run(status, threadId);
  }
}
