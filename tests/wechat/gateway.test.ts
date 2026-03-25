import { describe, expect, it, vi } from "vitest";
import { createWeChatGateway } from "../../src/wechat/gateway.js";

describe("WeChatGateway", () => {
  it("maps inbound text messages into internal thread input", async () => {
    const onMessage = vi.fn();
    const gateway = createWeChatGateway({ onMessage });

    await gateway.handleInbound({ fromUserId: "wxid_admin", text: "run tests", contextToken: "ctx" });

    expect(onMessage).toHaveBeenCalledWith(
      expect.objectContaining({ fromUserId: "wxid_admin", text: "run tests", contextToken: "ctx" }),
    );
  });
});
