import { describe, expect, it, vi } from "vitest";
import { createTuiController, decodeTerminalInput } from "../../src/tui/runtime.js";
import type { ApprovalQueueItem } from "../../src/tui/widgets/approval-queue.js";

function approvalItem(overrides: Partial<ApprovalQueueItem> = {}): ApprovalQueueItem {
  return {
    id: "approval-1",
    threadId: "thread-1",
    tool: "shell.exec",
    status: "pending",
    summary: "run pwd",
    ...overrides,
  };
}

describe("createTuiController", () => {
  it("moves selection down and up within bounds", async () => {
    const controller = createTuiController({
      app: {
        resumeApproval: vi.fn(),
        rejectApproval: vi.fn(),
      },
    });
    const approvals = [
      approvalItem({ id: "approval-1" }),
      approvalItem({ id: "approval-2" }),
      approvalItem({ id: "approval-3" }),
    ];

    controller.setApprovalItems(approvals);

    await controller.handleInput({ kind: "down" }, approvals);
    await controller.handleInput({ kind: "down" }, approvals);
    await controller.handleInput({ kind: "down" }, approvals);

    expect(controller.getState().selectedApprovalIndex).toBe(2);

    await controller.handleInput({ kind: "up" }, approvals);
    await controller.handleInput({ kind: "up" }, approvals);
    await controller.handleInput({ kind: "up" }, approvals);

    expect(controller.getState().selectedApprovalIndex).toBe(0);
  });

  it("approves the selected approval", async () => {
    const resumeApproval = vi.fn();
    const controller = createTuiController({
      app: {
        resumeApproval,
        rejectApproval: vi.fn(),
      },
    });
    const approvals = [
      approvalItem({ id: "approval-1" }),
      approvalItem({ id: "approval-2" }),
    ];

    controller.setApprovalItems(approvals);
    await controller.handleInput({ kind: "down" }, approvals);
    await controller.handleInput({ kind: "approve" }, approvals);

    expect(resumeApproval).toHaveBeenCalledWith("approval-2");
  });

  it("rejects the selected approval with the typed reason", async () => {
    const rejectApproval = vi.fn();
    const controller = createTuiController({
      app: {
        resumeApproval: vi.fn(),
        rejectApproval,
      },
    });
    const approvals = [approvalItem({ id: "approval-1" })];

    controller.setApprovalItems(approvals);
    await controller.handleInput({ kind: "reject" }, approvals);
    await controller.handleInput({ kind: "char", value: "n" }, approvals);
    await controller.handleInput({ kind: "char", value: "o" }, approvals);

    expect(controller.getState()).toMatchObject({
      mode: "reject_input",
      selectedApprovalIndex: 0,
      rejectReason: "no",
    });

    await controller.handleInput({ kind: "submit" }, approvals);

    expect(rejectApproval).toHaveBeenCalledWith("approval-1", "no");
    expect(controller.getState()).toMatchObject({
      mode: "browse",
      selectedApprovalIndex: 0,
      rejectReason: "",
    });
  });

  it("cancels reject-input mode on escape without dispatching", async () => {
    const rejectApproval = vi.fn();
    const controller = createTuiController({
      app: {
        resumeApproval: vi.fn(),
        rejectApproval,
      },
    });
    const approvals = [approvalItem({ id: "approval-1" })];

    controller.setApprovalItems(approvals);
    await controller.handleInput({ kind: "reject" }, approvals);
    await controller.handleInput({ kind: "char", value: "x" }, approvals);
    await controller.handleInput({ kind: "escape" }, approvals);

    expect(rejectApproval).not.toHaveBeenCalled();
    expect(controller.getState()).toMatchObject({
      mode: "browse",
      selectedApprovalIndex: 0,
      rejectReason: "",
    });
  });

  it("decodes terminal key input for navigation and reject entry", () => {
    expect(decodeTerminalInput("j")).toEqual([{ kind: "down" }]);
    expect(decodeTerminalInput("k")).toEqual([{ kind: "up" }]);
    expect(decodeTerminalInput("\u001b[B")).toEqual([{ kind: "down" }]);
    expect(decodeTerminalInput("\u001b[A")).toEqual([{ kind: "up" }]);
    expect(decodeTerminalInput("a")).toEqual([{ kind: "approve" }]);
    expect(decodeTerminalInput("r")).toEqual([{ kind: "reject" }]);
    expect(decodeTerminalInput("q")).toEqual([{ kind: "quit" }]);
    expect(decodeTerminalInput("\r")).toEqual([{ kind: "submit" }]);
    expect(decodeTerminalInput("\u007f")).toEqual([{ kind: "backspace" }]);
    expect(decodeTerminalInput("\u001b")).toEqual([{ kind: "escape" }]);
    expect(decodeTerminalInput("no")).toEqual([
      { kind: "char", value: "n" },
      { kind: "char", value: "o" },
    ]);
  });

  it("treats printable keys as text while reject input is active", () => {
    expect(decodeTerminalInput("r", "reject_input")).toEqual([{ kind: "char", value: "r" }]);
    expect(decodeTerminalInput("q", "reject_input")).toEqual([{ kind: "char", value: "q" }]);
    expect(decodeTerminalInput("\r", "reject_input")).toEqual([{ kind: "submit" }]);
    expect(decodeTerminalInput("\u001b", "reject_input")).toEqual([{ kind: "escape" }]);
  });
});
