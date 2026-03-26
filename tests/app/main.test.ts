import { describe, expect, it, vi } from "vitest";
import { createApplication } from "../../src/app/main.js";

describe("createApplication", () => {
  it("runs one auto-approved tool action and sends a final reply", async () => {
    const sendReply = vi.fn();
    const appendEvent = vi.fn();
    const markDone = vi.fn();

    const app = createApplication({
      adminUserId: "wxid_admin",
      runtime: {
        async planNext() {
          return {
            reply: "Searching the web first.",
            actions: [{ tool: "web.search", input: { query: "rustls" } }],
          };
        },
      },
      approvals: {
        classifyAction(action: { tool: string }) {
          return { decision: action.tool === "web.search" ? "auto_approve" : ("approval_required" as const) };
        },
      },
      tools: {
        async run(action: { tool: string; input: unknown }) {
          return { ok: true, output: { items: [{ title: "rustls" }], action } };
        },
      },
      taskService: {
        receiveMessage() {
          return { threadId: "t1" };
        },
        appendEvent,
        markDone,
      },
      sendReply,
    });

    await app.handleAdminMessage({ fromUserId: "wxid_admin", text: "search rustls", contextToken: "ctx" });

    expect(appendEvent).toHaveBeenCalledWith("t1", expect.objectContaining({ kind: "tool.completed" }));
    expect(markDone).toHaveBeenCalledWith("t1");
    expect(sendReply).toHaveBeenCalledWith("wxid_admin", expect.stringContaining("Searching"));
  });
});
