import { describe, expect, it, vi } from "vitest";
import { createApplication } from "../../src/app/main.js";

describe("createApplication", () => {
  it("connects gateway, task service, runtime, approvals, and tools into one message loop", async () => {
    const sendReply = vi.fn();
    const app = createApplication({ sendReply });

    await app.handleAdminMessage({ fromUserId: "wxid_admin", text: "search rustls", contextToken: "ctx" });

    expect(sendReply).toHaveBeenCalled();
  });
});
