import { describe, expect, it } from "vitest";
import { buildMainViewModel, renderMainScreen } from "../../src/tui/app.js";

describe("buildMainViewModel", () => {
  it("projects interactive approval state and selected-thread events into the main screen", () => {
    const model = buildMainViewModel({
      threads: [
        {
          id: "t1",
          title: "Run shell command",
          status: "failed",
          latestEventSummary: "approval rejected: too risky",
        },
        {
          id: "t2",
          title: "Write config",
          status: "waiting_approval",
          latestEventSummary: "approval requested",
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
      eventsByThread: {
        t1: [
          { id: "e1", summary: "approval.rejected: too risky" },
          { id: "e2", summary: "thread.failed: approval rejected" },
        ],
        t2: [
          { id: "e3", summary: "approval.requested: write config" },
          { id: "e4", summary: "thread.waiting_approval" },
        ],
      },
      interaction: {
        mode: "reject_input",
        selectedApprovalIndex: 1,
        rejectReason: "needs review",
      },
    });
    const rendered = renderMainScreen(model);

    expect(model.threadItems[0]?.label).toContain("Run shell command");
    expect(model.threadItems[0]?.label).toContain("failed");
    expect(model.threadItems[0]?.label).toContain("too risky");
    expect(model.threadItems[1]).toMatchObject({
      id: "t2",
      isSelected: true,
    });
    expect(model.pendingApprovalCount).toBe(1);
    expect(model.approvalItems[0]).toEqual({
      id: "a1",
      threadId: "t1",
      tool: "shell.exec",
      status: "rejected",
      summary: "too risky",
      label: "  [rejected] shell.exec - too risky",
      isSelected: false,
    });
    expect(model.approvalItems[1]).toEqual({
      id: "a2",
      threadId: "t2",
      tool: "fs.write",
      status: "pending",
      summary: "write config",
      label: "> [pending] fs.write - write config",
      isSelected: true,
    });
    expect(model.eventItems).toEqual([
      { id: "e3", summary: "approval.requested: write config" },
      { id: "e4", summary: "thread.waiting_approval" },
    ]);
    expect(model.rejectPrompt).toEqual({
      label: "Reject reason",
      value: "needs review",
    });
    expect(model.footerText).toContain("Enter");
    expect(rendered).toContain("> [pending] fs.write - write config");
    expect(rendered).toContain("Reject reason: needs review");
    expect(rendered).toContain("approval.requested: write config");
  });

  it("renders explicit recovery messaging when pending approvals remain after restart", () => {
    const model = buildMainViewModel({
      threads: [
        {
          id: "t2",
          title: "Write config",
          status: "waiting_approval",
          latestEventSummary: "approval requested",
        },
      ],
      approvals: [
        {
          id: "a2",
          threadId: "t2",
          tool: "fs.write",
          status: "pending",
          summary: "write config",
        },
      ],
      eventsByThread: {
        t2: [
          { id: "e3", summary: "approval.requested: write config" },
        ],
      },
    });
    const rendered = renderMainScreen(model);

    expect(model.recoveryBannerText).toBe("Recovered pending approvals from the previous run.");
    expect(model.recoveryHintText).toBe("Approve or reject a recovered approval to continue.");
    expect(model.footerText).toContain("a approves");
    expect(model.footerText).toContain("r rejects");
    expect(rendered).toContain("Recovered pending approvals from the previous run.");
    expect(rendered).toContain("Approve or reject a recovered approval to continue.");
  });

  it("renders informational recovery messaging when only waiting threads remain", () => {
    const model = buildMainViewModel({
      threads: [
        {
          id: "t2",
          title: "Write config",
          status: "waiting_approval",
          latestEventSummary: "approval requested",
        },
      ],
      approvals: [],
    });
    const rendered = renderMainScreen(model);

    expect(model.recoveryBannerText).toBe("Recovered waiting threads from the previous run.");
    expect(model.recoveryHintText).toBe("Recovered context only. No approval action is available.");
    expect(model.footerText).toBe("Recovered context only. Press q to quit.");
    expect(model.footerText).not.toContain("approves");
    expect(model.footerText).not.toContain("rejects");
    expect(rendered).toContain("Recovered waiting threads from the previous run.");
    expect(rendered).toContain("Recovered context only. No approval action is available.");
  });

  it("renders informational recovery messaging when only failed threads remain", () => {
    const model = buildMainViewModel({
      threads: [
        {
          id: "t1",
          title: "Run shell command",
          status: "failed",
          latestEventSummary: "approval rejected: too risky",
        },
      ],
      approvals: [],
    });
    const rendered = renderMainScreen(model);

    expect(model.recoveryBannerText).toBe("Recovered failed threads from the previous run.");
    expect(model.recoveryHintText).toBe("Recovered context only. No approval action is available.");
    expect(model.footerText).toBe("Recovered context only. Press q to quit.");
    expect(model.footerText).not.toContain("approves");
    expect(model.footerText).not.toContain("rejects");
    expect(rendered).toContain("Recovered failed threads from the previous run.");
    expect(rendered).toContain("Recovered context only. No approval action is available.");
  });
});
