import { describe, expect, it } from "vitest";
import { createTaskService } from "../../src/tasks/service.js";

describe("TaskService", () => {
  it("reuses the latest unfinished thread for the same admin", () => {
    const service = createTaskService();

    const first = service.receiveMessage({ fromUserId: "wxid_admin", text: "search rustls" });
    const second = service.receiveMessage({ fromUserId: "wxid_admin", text: "now summarize it" });

    expect(second.threadId).toBe(first.threadId);
    expect(service.getThread(first.threadId)?.status).toBe("queued");
  });

  it("supports minimal event lifecycle: append event, mark done, and list events", () => {
    const service = createTaskService();

    const result = service.receiveMessage({ fromUserId: "wxid_admin", text: "search rustls" });
    const threadId = result.threadId;

    service.appendEvent(threadId, { kind: "tool.completed", summary: "web search done" });
    service.markDone(threadId);

    expect(service.getThread(threadId)?.status).toBe("done");

    const events = service.listEvents(threadId);
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("tool.completed");
    expect(events[0].summary).toBe("web search done");
  });

  it("supports approval lifecycle: create, mark waiting, get pending, and mark approved", () => {
    const service = createTaskService();

    const result = service.receiveMessage({ fromUserId: "wxid_admin", text: "search rustls" });
    const threadId = result.threadId;

    const approval = service.createApprovalRequest(threadId, { tool: "shell.exec", input: { command: "pwd" } }, "rm -rf /");
    expect(approval.approvalId).toBeTruthy();
    const approvalId = approval.approvalId;

    service.markWaitingApproval(threadId);
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
});
