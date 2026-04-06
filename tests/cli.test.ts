import { describe, expect, it, vi } from "vitest";
import { runCli } from "../src/cli.js";

describe("runCli", () => {
  it("submits an admin message through the composed app path", async () => {
    const setCurrentMessage = vi.fn();
    const handleAdminMessage = vi.fn();
    const write = vi.fn();

    const exitCode = await runCli(["message", "run", "smoke", "test"], {
      env: { ADMIN_USER_ID: "wxid_admin" },
      stdout: { write },
      stderr: { write: vi.fn() },
      bootstrapApplication: vi.fn().mockResolvedValue({
        app: { handleAdminMessage },
        taskService: {},
        setCurrentMessage,
      }),
    });

    expect(exitCode).toBe(0);
    expect(setCurrentMessage).toHaveBeenCalledWith({
      fromUserId: "wxid_admin",
      text: "run smoke test",
    });
    expect(handleAdminMessage).toHaveBeenCalledWith({
      fromUserId: "wxid_admin",
      text: "run smoke test",
      contextToken: "cli-message",
    });
    expect(write).toHaveBeenCalledWith(expect.stringContaining("Message submitted"));
  });

  it("approves a stored action and prints the final thread status", async () => {
    const resumeApproval = vi.fn();
    const write = vi.fn();

    const exitCode = await runCli(["approve", "ap1"], {
      env: { ADMIN_USER_ID: "wxid_admin" },
      stdout: { write },
      stderr: { write: vi.fn() },
      bootstrapApplication: vi.fn().mockResolvedValue({
        app: { resumeApproval },
        taskService: {
          getPendingApproval() {
            return { id: "ap1", threadId: "t1", status: "approved" };
          },
          getThread() {
            return { id: "t1", status: "done" };
          },
        },
        setCurrentMessage: vi.fn(),
      }),
    });

    expect(exitCode).toBe(0);
    expect(resumeApproval).toHaveBeenCalledWith("ap1");
    expect(write).toHaveBeenCalledWith(expect.stringContaining("Final thread status: done"));
  });

  it("rejects a stored action with a reason and prints the failed thread status", async () => {
    const rejectApproval = vi.fn();
    const write = vi.fn();

    const exitCode = await runCli(["reject", "ap1", "too", "risky"], {
      env: { ADMIN_USER_ID: "wxid_admin" },
      stdout: { write },
      stderr: { write: vi.fn() },
      bootstrapApplication: vi.fn().mockResolvedValue({
        app: { rejectApproval },
        taskService: {
          getPendingApproval() {
            return { id: "ap1", threadId: "t1", status: "rejected" };
          },
          getThread() {
            return { id: "t1", status: "failed" };
          },
        },
        setCurrentMessage: vi.fn(),
      }),
    });

    expect(exitCode).toBe(0);
    expect(rejectApproval).toHaveBeenCalledWith("ap1", "too risky");
    expect(write).toHaveBeenCalledWith(expect.stringContaining("Final thread status: failed"));
  });

  it("bootstraps the app and starts the tui runtime", async () => {
    const startTuiRuntime = vi.fn();
    const bootstrapApplication = vi.fn().mockResolvedValue({
      app: {
        handleAdminMessage: vi.fn(),
        resumeApproval: vi.fn(),
        rejectApproval: vi.fn(),
      },
      taskService: {
        listThreads: vi.fn().mockReturnValue([]),
        listApprovals: vi.fn().mockReturnValue([]),
        listEvents: vi.fn().mockReturnValue([]),
      },
      setCurrentMessage: vi.fn(),
    });

    const exitCode = await runCli(["tui"], {
      env: { ADMIN_USER_ID: "wxid_admin" },
      stdout: { write: vi.fn() },
      stderr: { write: vi.fn() },
      bootstrapApplication,
      startTuiRuntime,
    });

    expect(exitCode).toBe(0);
    expect(bootstrapApplication).toHaveBeenCalledWith({ env: { ADMIN_USER_ID: "wxid_admin" } });
    expect(startTuiRuntime).toHaveBeenCalledWith(
      expect.objectContaining({
        app: expect.any(Object),
        taskService: expect.any(Object),
      }),
      expect.objectContaining({
        stdin: process.stdin,
        stdout: expect.any(Object),
      }),
    );
  });

  it("prints usage for an unknown subcommand", async () => {
    const stdoutWrite = vi.fn();
    const stderrWrite = vi.fn();

    const exitCode = await runCli(["unknown"], {
      env: { ADMIN_USER_ID: "wxid_admin" },
      stdout: { write: stdoutWrite },
      stderr: { write: stderrWrite },
      bootstrapApplication: vi.fn(),
    });

    expect(exitCode).toBe(1);
    expect(stderrWrite).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
    expect(stdoutWrite).not.toHaveBeenCalled();
  });

  it("prints usage when no subcommand is provided", async () => {
    const stdoutWrite = vi.fn();
    const stderrWrite = vi.fn();

    const exitCode = await runCli([], {
      env: { ADMIN_USER_ID: "wxid_admin" },
      stdout: { write: stdoutWrite },
      stderr: { write: stderrWrite },
      bootstrapApplication: vi.fn(),
    });

    expect(exitCode).toBe(1);
    expect(stderrWrite).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
    expect(stdoutWrite).not.toHaveBeenCalled();
  });

  it("prints usage for tui command arguments", async () => {
    const stdoutWrite = vi.fn();
    const stderrWrite = vi.fn();

    const exitCode = await runCli(["tui", "extra"], {
      env: { ADMIN_USER_ID: "wxid_admin" },
      stdout: { write: stdoutWrite },
      stderr: { write: stderrWrite },
      bootstrapApplication: vi.fn(),
    });

    expect(exitCode).toBe(1);
    expect(stderrWrite).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
    expect(stdoutWrite).not.toHaveBeenCalled();
  });
});
