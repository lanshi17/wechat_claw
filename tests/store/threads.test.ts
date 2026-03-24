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
});
