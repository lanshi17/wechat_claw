import { describe, expect, it, vi } from "vitest";
import { createWeChatGateway } from "../../src/wechat/gateway.js";

describe("WeChatGateway", () => {
  it("maps inbound text messages into internal thread input", async () => {
    const onMessage = vi.fn();
    const gateway = createWeChatGateway({ adminUserId: "wxid_admin", onMessage });

    await gateway.handleInbound({ fromUserId: "wxid_admin", text: "run tests", contextToken: "ctx" });

    expect(onMessage).toHaveBeenCalledWith(
      expect.objectContaining({ fromUserId: "wxid_admin", text: "run tests", contextToken: "ctx" }),
    );
  });

  it("ignores inbound messages from non-admin users", async () => {
    const onMessage = vi.fn();
    const gateway = createWeChatGateway({ adminUserId: "wxid_admin", onMessage });

    await gateway.handleInbound({ fromUserId: "wxid_guest", text: "run tests", contextToken: "ctx" });

    expect(onMessage).not.toHaveBeenCalled();
  });
});
