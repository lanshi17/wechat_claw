import { describe, expect, it } from "vitest";
import { buildMainViewModel } from "../../src/tui/app.js";

describe("buildMainViewModel", () => {
  it("projects threads, latest events, and pending approvals into screen state", () => {
    const model = buildMainViewModel({
      threads: [{ id: "t1", title: "Fix tests", status: "waiting_approval" }],
      approvals: [{ id: "a1", threadId: "t1", tool: "shell.exec" }],
    });

    expect(model.threadItems[0]?.label).toContain("Fix tests");
    expect(model.pendingApprovalCount).toBe(1);
  });
});
