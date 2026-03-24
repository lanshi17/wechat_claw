import { describe, expect, it } from "vitest";
import { createBootstrapConfig } from "../../src/app/bootstrap.js";

describe("createBootstrapConfig", () => {
  it("normalizes the MVP defaults", () => {
    const cfg = createBootstrapConfig({ workspaceRoot: "/tmp/demo" });

    expect(cfg.platform).toBe("linux");
    expect(cfg.workspaceRoot).toBe("/tmp/demo");
    expect(cfg.approvalMode).toBe("mixed");
  });
});
