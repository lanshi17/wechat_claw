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
        markDone: vi.fn(),
      },
      sendReply,
    });

    await app.handleAdminMessage({ fromUserId: "wxid_admin", text: "run pwd", contextToken: "ctx" });

    expect(createApprovalRequest).toHaveBeenCalledWith(
      "t1",
      expect.objectContaining({ tool: "shell.exec" }),
      "This needs approval.",
    );
    expect(markWaitingApproval).toHaveBeenCalledWith("t1");
    expect(toolsRun).not.toHaveBeenCalled();
    expect(sendReply).toHaveBeenCalledWith("wxid_admin", expect.stringContaining("ap1"));
  });

  it("resumes an approved action and completes the thread", async () => {
    const sendReply = vi.fn();
    const appendEvent = vi.fn();
    const markDone = vi.fn();
    const toolsRun = vi.fn().mockResolvedValue({ ok: true, tool: "shell.exec", output: { exitCode: 0, stdout: "/workspace", stderr: "" } });

    const app = createApplication({
      adminUserId: "wxid_admin",
      runtime: { async planNext() { return { reply: "unused", actions: [] }; } },
      approvals: { classifyAction() { return { decision: "approval_required" as const }; } },
      tools: { run: toolsRun },
      taskService: {
        receiveMessage() {
          return { threadId: "t1" };
        },
        appendEvent,
        createApprovalRequest: vi.fn(),
        markWaitingApproval: vi.fn(),
        getPendingApproval() {
          return {
            id: "ap1",
            threadId: "t1",
            action: { tool: "shell.exec", input: { command: "pwd" } },
            reply: "Approved result coming.",
            status: "pending",
          };
        },
        markApproved: vi.fn(),
        markDone,
      },
      sendReply,
    });

    await app.resumeApproval("ap1");

    expect(toolsRun).toHaveBeenCalledWith({ tool: "shell.exec", input: { command: "pwd" } });
    expect(appendEvent).toHaveBeenCalledWith("t1", expect.objectContaining({ kind: "tool.completed" }));
    expect(markDone).toHaveBeenCalledWith("t1");
    expect(sendReply).toHaveBeenCalledWith("wxid_admin", "Approved result coming.");
  });
});
