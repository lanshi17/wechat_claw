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
});
