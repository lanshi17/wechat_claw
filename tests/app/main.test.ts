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

  it("pauses when an action requires approval and returns an approval id", async () => {
    const sendReply = vi.fn();
    const createApprovalRequest = vi.fn().mockReturnValue({ approvalId: "ap1" });
    const appendEvent = vi.fn();
    const markWaitingApproval = vi.fn();
    const markDone = vi.fn();
    const toolsRun = vi.fn();

    const app = createApplication({
      adminUserId: "wxid_admin",
      runtime: {
        async planNext() {
          return {
            reply: "This needs approval.",
            actions: [{ tool: "shell.exec", input: { command: "pwd" } }],
          };
        },
      },
      approvals: {
        classifyAction() {
          return { decision: "approval_required" as const };
        },
      },
      tools: { run: toolsRun },
      taskService: {
        receiveMessage() {
          return { threadId: "t1" };
        },
        appendEvent,
        createApprovalRequest,
        markWaitingApproval,
        markDone,
      },
      sendReply,
    });

    await app.handleAdminMessage({ fromUserId: "wxid_admin", text: "run pwd", contextToken: "ctx" });

    expect(createApprovalRequest).toHaveBeenCalledWith(
      "t1",
      expect.objectContaining({ tool: "shell.exec" }),
      "This needs approval.",
    );
    expect(markWaitingApproval).toHaveBeenCalledWith("t1", {
      tool: "shell.exec",
      summary: "This needs approval.",
    });
    expect(toolsRun).not.toHaveBeenCalled();
    expect(markDone).not.toHaveBeenCalled();
    expect(sendReply).toHaveBeenCalledWith("wxid_admin", expect.stringContaining("ap1"));
  });

  it("handles auto-approved and approval-required actions across threads", async () => {
    const sendReply = vi.fn();
    const threads = new Map<string, { status: string }>();
    const events = new Map<string, Array<{ kind: string; summary?: string; result?: unknown }>>();
    const approvals = new Map<string, { id: string; threadId: string; action: { tool: string; input: unknown }; reply: string; status: string }>();
    let threadCount = 0;
    let approvalCount = 0;

    const taskService = {
      receiveMessage() {
        threadCount += 1;
        const threadId = `t${threadCount}`;
        threads.set(threadId, { status: "queued" });
        return { threadId };
      },
      appendEvent(threadId: string, event: { kind: string; summary?: string; result?: unknown }) {
        const threadEvents = events.get(threadId) ?? [];
        threadEvents.push(event);
        events.set(threadId, threadEvents);
      },
      createApprovalRequest(threadId: string, action: { tool: string; input: unknown }, reply: string) {
        approvalCount += 1;
        const approval = {
          id: `ap${approvalCount}`,
          threadId,
          action,
          reply,
          status: "pending",
        };
        approvals.set(approval.id, approval);
        return { approvalId: approval.id };
      },
      markWaitingApproval(threadId: string) {
        threads.set(threadId, { status: "waiting_approval" });
      },
      markDone(threadId: string) {
        threads.set(threadId, { status: "done" });
      },
      getPendingApproval(approvalId: string) {
        return approvals.get(approvalId);
      },
      markApproved(approvalId: string) {
        const approval = approvals.get(approvalId);
        if (approval) {
          approval.status = "approved";
        }
      },
    };

    const toolsRun = vi.fn().mockImplementation(async (action: { tool: string; input: unknown }) => {
      if (action.tool === "web.search") {
        return { ok: true, tool: action.tool, output: { items: [{ title: "rustls" }] } };
      }

      return { ok: true, tool: action.tool, output: { exitCode: 0, stdout: "/workspace", stderr: "" } };
    });

    const plans = [
      {
        reply: "Searching the web first.",
        actions: [{ tool: "web.search", input: { query: "rustls" } }],
      },
      {
        reply: "Need approval.",
        actions: [{ tool: "shell.exec", input: { command: "pwd" } }],
      },
    ];

    const app = createApplication({
      adminUserId: "wxid_admin",
      runtime: {
        async planNext() {
          const next = plans.shift();
          if (!next) {
            throw new Error("no plan available");
          }
          return next;
        },
      },
      approvals: {
        classifyAction(action: { tool: string }) {
          return { decision: action.tool === "shell.exec" ? ("approval_required" as const) : ("auto_approve" as const) };
        },
      },
      tools: { run: toolsRun },
      taskService,
      sendReply,
    });

    await app.handleAdminMessage({ fromUserId: "wxid_admin", text: "search rustls", contextToken: "ctx-1" });
    await app.handleAdminMessage({ fromUserId: "wxid_admin", text: "pwd", contextToken: "ctx-2" });

    expect(events.get("t1")).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "tool.completed" })]),
    );
    expect(threads.get("t1")?.status).toBe("done");
    expect(sendReply).toHaveBeenCalledWith("wxid_admin", "Searching the web first.");

    expect(threads.get("t2")?.status).toBe("waiting_approval");
    expect(approvals.get("ap1")?.action.tool).toBe("shell.exec");
    expect(toolsRun).toHaveBeenCalledTimes(1);
    expect(sendReply).toHaveBeenCalledWith("wxid_admin", expect.stringContaining("ap1"));
  });
});
