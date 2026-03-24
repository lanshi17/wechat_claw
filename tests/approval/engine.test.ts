import { describe, expect, it } from "vitest";
import { classifyAction } from "../../src/approval/engine.js";

describe("classifyAction", () => {
  it("requires approval for shell execution and file writes", () => {
    expect(classifyAction({ tool: "shell.exec" }).decision).toBe("approval_required");
    expect(classifyAction({ tool: "fs.write" }).decision).toBe("approval_required");
    expect(classifyAction({ tool: "fs.read" }).decision).toBe("auto_approve");
  });
});
