import { describe, expect, it } from "vitest";
import { createInMemoryDatabase } from "../../src/store/db.js";
import { ThreadRepository } from "../../src/store/repositories/threads.js";

describe("ThreadRepository", () => {
  it("creates a thread and appends an event", () => {
    const db = createInMemoryDatabase();
    const repo = new ThreadRepository(db);

    const thread = repo.create({ sourceUserId: "wxid_admin", title: "Fix tests" });
    repo.appendEvent(thread.id, { kind: "message.received", summary: "please fix tests" });

    expect(repo.get(thread.id)?.title).toBe("Fix tests");
    expect(repo.listEvents(thread.id)).toHaveLength(1);
  });

  it("persists thread status and events", () => {
    const db = createInMemoryDatabase();
    const repo = new ThreadRepository(db);

    const thread = repo.create({ sourceUserId: "wxid_admin", title: "Run smoke flow" });
    repo.updateStatus(thread.id, "waiting_approval");
    repo.appendEvent(thread.id, { kind: "approval.requested", summary: "shell.exec approval required" });

    expect(repo.get(thread.id)).toEqual(
      expect.objectContaining({ id: thread.id, status: "waiting_approval" }),
    );
    expect(repo.listEvents(thread.id)).toEqual([
      expect.objectContaining({ kind: "approval.requested", summary: "shell.exec approval required" }),
    ]);
  });
});
