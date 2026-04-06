import { describe, expect, it, vi } from "vitest";
import { runMvpSmoke } from "../src/smoke.js";

describe("runMvpSmoke", () => {
  it("submits a smoke message, resumes the new approval, and prints final status", async () => {
    const approvals: Array<{
      id: string;
      threadId: string;
      status: string;
      action: { tool: string; input: { command: string } };
      reply: string;
    }> = [];
    const stdout = { write: vi.fn() };
    const stderr = { write: vi.fn() };
    const thread = { id: "t1", status: "waiting_approval" };
    const resumeApproval = vi.fn().mockImplementation(async () => {
      thread.status = "done";
    });
    const gatewayHandleInbound = vi.fn();

    const exitCode = await runMvpSmoke({
      env: { ADMIN_USER_ID: "wxid_admin" },
      stdout,
      stderr,
      bootstrapApplication: vi.fn().mockResolvedValue({
        app: { resumeApproval },
        gateway: {
          handleInbound: gatewayHandleInbound.mockImplementation(async () => {
            approvals.push({
              id: "ap1",
              threadId: "t1",
              status: "pending",
              action: { tool: "shell.exec", input: { command: "pwd" } },
              reply: "Need approval",
            });
          }),
        },
        taskService: {
          listApprovals: () => approvals,
          getThread: () => thread,
        },
      }),
    });

    expect(exitCode).toBe(0);
    expect(gatewayHandleInbound).toHaveBeenCalledTimes(1);
    expect(resumeApproval).toHaveBeenCalledWith("ap1");
    expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining("Final thread status: done"));
    expect(stderr.write).not.toHaveBeenCalled();
  });

  it("fails when no new pending approval is created", async () => {
    const stdout = { write: vi.fn() };
    const stderr = { write: vi.fn() };

    const exitCode = await runMvpSmoke({
      env: { ADMIN_USER_ID: "wxid_admin" },
      stdout,
      stderr,
      bootstrapApplication: vi.fn().mockResolvedValue({
        app: { resumeApproval: vi.fn() },
        gateway: { handleInbound: vi.fn() },
        taskService: {
          listApprovals: () => [],
          getThread: () => undefined,
        },
      }),
    });

    expect(exitCode).toBe(1);
    expect(stderr.write).toHaveBeenCalledWith(expect.stringContaining("No new pending approval"));
  });
});
