import { describe, expect, it } from "vitest";
import { buildMainViewModel } from "../../src/tui/app.js";

describe("buildMainViewModel", () => {
  it("projects approval decisions and failed-thread summaries into screen state", () => {
    const model = buildMainViewModel({
      threads: [
        {
          id: "t1",
          title: "Run shell command",
          status: "failed",
          latestEventSummary: "approval rejected: too risky",
        },
      ],
      approvals: [
        {
          id: "a1",
          threadId: "t1",
          tool: "shell.exec",
          status: "rejected",
          summary: "too risky",
        },
        {
          id: "a2",
          threadId: "t2",
          tool: "fs.write",
          status: "pending",
          summary: "write config",
        },
      ],
      events: [
        { id: "e1", summary: "approval.rejected: too risky" },
        { id: "e2", summary: "thread.failed: approval rejected" },
      ],
    });

    expect(model.threadItems[0]?.label).toContain("Run shell command");
    expect(model.threadItems[0]?.label).toContain("failed");
    expect(model.threadItems[0]?.label).toContain("too risky");
    expect(model.pendingApprovalCount).toBe(1);
    expect(model.approvalItems[0]).toEqual({
      id: "a1",
      threadId: "t1",
      tool: "shell.exec",
      status: "rejected",
      summary: "too risky",
    });
    expect(model.approvalItems[1]).toEqual({
      id: "a2",
      threadId: "t2",
      tool: "fs.write",
      status: "pending",
      summary: "write config",
    });
    expect(model.eventItems).toEqual([
      { id: "e1", summary: "approval.rejected: too risky" },
      { id: "e2", summary: "thread.failed: approval rejected" },
    ]);
  });
});
