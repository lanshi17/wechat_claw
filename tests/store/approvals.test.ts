import { describe, expect, it, beforeEach } from "vitest";
import { createInMemoryDatabase } from "../../src/store/db.js";
import { ApprovalRepository } from "../../src/store/repositories/approvals.js";
import { ThreadRepository } from "../../src/store/repositories/threads.js";

describe("ApprovalRepository", () => {
  let db: any;
  let threadRepo: ThreadRepository;
  let approvalRepo: ApprovalRepository;
  let threadId: string;

  beforeEach(() => {
    db = createInMemoryDatabase();
    threadRepo = new ThreadRepository(db);
    approvalRepo = new ApprovalRepository(db);
    const thread = threadRepo.create({ sourceUserId: "wxid_admin", title: "Test thread" });
    threadId = thread.id;
  });

  it("creates an approval request with action and reply", () => {
    const approval = approvalRepo.create({
      threadId,
      action: { tool: "shell.exec", input: { command: "rm -rf /" } },
      reply: "Execute dangerous command?",
    });

    expect(approval).toMatchObject({
      id: expect.any(String),
      threadId,
      status: "pending",
      action: { tool: "shell.exec", input: { command: "rm -rf /" } },
      reply: "Execute dangerous command?",
    });
  });

  it("retrieves approval request by id", () => {
    const approval = approvalRepo.create({
      threadId,
      action: { tool: "web.fetch", input: { url: "https://example.com" } },
      reply: "Fetch URL?",
    });

    const retrieved = approvalRepo.get(approval.id);
    expect(retrieved).toEqual(approval);
  });

  it("marks approval as approved", () => {
    const approval = approvalRepo.create({
      threadId,
      action: { tool: "shell.exec", input: { command: "ls" } },
      reply: "List directory?",
    });

    approvalRepo.markApproved(approval.id);

    const updated = approvalRepo.get(approval.id);
    expect(updated?.status).toBe("approved");
  });

  it("persists action as JSON in database", () => {
    const complexAction = {
      tool: "shell.exec",
      input: {
        command: "npm run test",
        cwd: "/workspace",
        timeout: 30000,
      },
    };

    const approval = approvalRepo.create({
      threadId,
      action: complexAction,
      reply: "Run tests?",
    });

    const retrieved = approvalRepo.get(approval.id);
    expect(retrieved?.action).toEqual(complexAction);
  });
});
