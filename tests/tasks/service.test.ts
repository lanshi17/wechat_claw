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
});
