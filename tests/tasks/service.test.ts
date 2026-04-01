import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createTaskService } from "../../src/tasks/service.js";
import Database from "better-sqlite3";
import { ThreadRepository } from "../../src/store/repositories/threads.js";
import { ApprovalRepository } from "../../src/store/repositories/approvals.js";
import path from "path";
import { fileURLToPath } from "url";
import { rmSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testDbPath = path.join(__dirname, "../../.test-db-service.db");

function initializeTestDb(): Database.Database {
  // Clean up any existing test db
  try {
    rmSync(testDbPath);
  } catch {
    // ignore if not exists
  }

  const db = new Database(testDbPath);

  // Create required tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS threads (
      id TEXT PRIMARY KEY,
      source_user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_events (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      summary TEXT NOT NULL,
      FOREIGN KEY (thread_id) REFERENCES threads(id)
    );

    CREATE TABLE IF NOT EXISTS approval_requests (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      status TEXT NOT NULL,
      action TEXT NOT NULL,
      reply TEXT NOT NULL,
      FOREIGN KEY (thread_id) REFERENCES threads(id)
    );
  `);

  return db;
}

describe("TaskService", () => {
  it("reuses the latest unfinished thread for the same admin", () => {
    const service = createTaskService();

    const first = service.receiveMessage({ fromUserId: "wxid_admin", text: "search rustls" });
    const second = service.receiveMessage({ fromUserId: "wxid_admin", text: "now summarize it" });

    expect(second.threadId).toBe(first.threadId);
    expect(service.getThread(first.threadId)?.status).toBe("queued");
  });

  it("records lifecycle and approval state for a thread", () => {
    const service = createTaskService();

    const received = service.receiveMessage({ fromUserId: "wxid_admin", text: "run pwd" });
    service.appendEvent(received.threadId, { kind: "plan.created", summary: "plan created" });
    service.markWaitingApproval(received.threadId, { tool: "shell.exec", summary: "waiting for shell approval" });

    expect(service.getThread(received.threadId)).toEqual(
      expect.objectContaining({
        id: received.threadId,
        title: "run pwd",
        status: "waiting_approval",
      }),
    );
    expect(service.listEvents(received.threadId)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "plan.created", summary: "plan created" }),
        expect.objectContaining({ kind: "approval.requested", summary: "waiting for shell approval" }),
      ]),
    );
  });

  it("marks a thread failed with a failure event", () => {
    const service = createTaskService();

    const received = service.receiveMessage({ fromUserId: "wxid_admin", text: "run pwd" });
    service.markFailed(received.threadId, "shell failed");

    expect(service.getThread(received.threadId)?.status).toBe("failed");
    expect(service.listEvents(received.threadId)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "thread.failed", summary: "shell failed" }),
      ]),
    );
  });

  it("reuses a waiting_approval thread for a second message from the same admin", () => {
    const service = createTaskService();

    const first = service.receiveMessage({ fromUserId: "wxid_admin", text: "search rustls" });
    service.markWaitingApproval(first.threadId);

    const second = service.receiveMessage({ fromUserId: "wxid_admin", text: "now summarize it" });

    expect(service.getThread(first.threadId)?.status).toBe("waiting_approval");
    expect(second.threadId).toBe(first.threadId);
  });

  it("creates a new thread after the previous one is marked done", () => {
    const service = createTaskService();

    const first = service.receiveMessage({ fromUserId: "wxid_admin", text: "search rustls" });
    service.markDone(first.threadId);

    const second = service.receiveMessage({ fromUserId: "wxid_admin", text: "now summarize it" });

    expect(service.getThread(first.threadId)?.status).toBe("done");
    expect(second.threadId).not.toBe(first.threadId);
    expect(service.getThread(second.threadId)?.status).toBe("queued");
  });

  it("supports approval lifecycle: create, mark waiting, get pending, and mark approved", () => {
    const service = createTaskService();

    const result = service.receiveMessage({ fromUserId: "wxid_admin", text: "search rustls" });
    const threadId = result.threadId;

    const approval = service.createApprovalRequest(threadId, { tool: "shell.exec", input: { command: "pwd" } }, "rm -rf /");
    expect(approval.approvalId).toBeTruthy();
    const approvalId = approval.approvalId;

    service.markWaitingApproval(threadId, { tool: "shell.exec", summary: "rm -rf /" });
    expect(service.getThread(threadId)?.status).toBe("waiting_approval");

    const pending = service.getPendingApproval(approvalId);
    expect(pending).toBeTruthy();
    expect(pending?.id).toBe(approvalId);
    expect(pending?.action).toEqual({ tool: "shell.exec", input: { command: "pwd" } });
    expect(pending?.reply).toBe("rm -rf /");
    expect(pending?.status).toBe("pending");

    service.markApproved(approvalId);
    const approved = service.getPendingApproval(approvalId);
    expect(approved?.status).toBe("approved");
  });

  it("reuses a waiting approval thread for a second admin message", () => {
    const service = createTaskService();

    const first = service.receiveMessage({ fromUserId: "wxid_admin", text: "search rustls" });
    service.markWaitingApproval(first.threadId);

    const second = service.receiveMessage({ fromUserId: "wxid_admin", text: "now summarize it" });

    expect(second.threadId).toBe(first.threadId);
    expect(service.getThread(first.threadId)?.status).toBe("waiting_approval");
  });

  it("creates a new thread after the previous thread is done", () => {
    const service = createTaskService();

    const first = service.receiveMessage({ fromUserId: "wxid_admin", text: "search rustls" });
    service.markDone(first.threadId);

    const second = service.receiveMessage({ fromUserId: "wxid_admin", text: "start a new task" });

    expect(second.threadId).not.toBe(first.threadId);
    expect(service.getThread(first.threadId)?.status).toBe("done");
    expect(service.getThread(second.threadId)?.status).toBe("queued");
  });

  describe("with DB-backed repositories", () => {
    let db: Database.Database;
    let threadRepo: ThreadRepository;
    let approvalRepo: ApprovalRepository;

    beforeEach(() => {
      db = initializeTestDb();
      threadRepo = new ThreadRepository(db);
      approvalRepo = new ApprovalRepository(db);
    });

    afterEach(() => {
      db.close();
      try {
        rmSync(testDbPath);
      } catch {
        // ignore
      }
    });

    it("persists thread state changes to database", () => {
      const service = createTaskService({ threadRepository: threadRepo, approvalRepository: approvalRepo });

      const result = service.receiveMessage({ fromUserId: "wxid_admin", text: "search rustls" });
      const threadId = result.threadId;

      service.markWaitingApproval(threadId);

      const fetched = threadRepo.get(threadId);
      expect(fetched).toBeTruthy();
      expect(fetched?.status).toBe("waiting_approval");

      service.markDone(threadId);
      const updated = threadRepo.get(threadId);
      expect(updated?.status).toBe("done");
    });

    it("persists events to database", () => {
      const service = createTaskService({ threadRepository: threadRepo, approvalRepository: approvalRepo });

      const result = service.receiveMessage({ fromUserId: "wxid_admin", text: "search rustls" });
      const threadId = result.threadId;

      service.appendEvent(threadId, { kind: "tool.completed", summary: "web search done" });
      service.appendEvent(threadId, { kind: "tool.failed", summary: "network error" });

      const events = threadRepo.listEvents(threadId);
      expect(events).toHaveLength(2);
      expect(events[0].kind).toBe("tool.completed");
      expect(events[0].summary).toBe("web search done");
      expect(events[1].kind).toBe("tool.failed");
      expect(events[1].summary).toBe("network error");
    });

    it("persists approval requests to database", () => {
      const service = createTaskService({ threadRepository: threadRepo, approvalRepository: approvalRepo });

      const result = service.receiveMessage({ fromUserId: "wxid_admin", text: "search rustls" });
      const threadId = result.threadId;

      const approval = service.createApprovalRequest(
        threadId,
        { tool: "shell.exec", input: { command: "rm -rf /" } },
        "destructive command"
      );
      const approvalId = approval.approvalId;

      service.markWaitingApproval(threadId);

      const fetched = service.getPendingApproval(approvalId);
      expect(fetched).toBeTruthy();
      expect(fetched?.status).toBe("pending");
      expect(fetched?.action.tool).toBe("shell.exec");
      expect(fetched?.reply).toBe("destructive command");

      service.markApproved(approvalId);
      const updated = service.getPendingApproval(approvalId);
      expect(updated?.status).toBe("approved");
      expect(approvalRepo.get(approvalId)?.status).toBe("approved");
    });
  });
});
