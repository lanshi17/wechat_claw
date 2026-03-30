import { describe, expect, it } from "vitest";
import { buildMainViewModel } from "../../src/tui/app.js";

describe("buildMainViewModel", () => {
  it("projects threads, latest events, and pending approvals into screen state", () => {
    const model = buildMainViewModel({
      threads: [
        {
          id: "t1",
          title: "Fix tests",
          status: "waiting_approval",
          latestEventSummary: "approval requested",
        },
      ],
      approvals: [{ id: "a1", threadId: "t1", tool: "shell.exec", summary: "pwd" }],
      events: [{ id: "e1", summary: "approval requested" }],
    });

    expect(model.threadItems[0]?.label).toContain("Fix tests");
    expect(model.threadItems[0]?.label).toContain("approval requested");
    expect(model.pendingApprovalCount).toBe(1);
    expect(model.approvalItems[0]).toEqual({ id: "a1", threadId: "t1", tool: "shell.exec", summary: "pwd" });
    expect(model.eventItems[0]).toEqual({ id: "e1", summary: "approval requested" });
  });
});
