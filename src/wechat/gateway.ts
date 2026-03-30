import type { InboundWeChatMessage } from "./types.js";

export function createWeChatGateway(deps: {
  adminUserId: string;
  onMessage: (message: InboundWeChatMessage) => Promise<void> | void;
}) {
  return {
    async handleInbound(message: InboundWeChatMessage) {
      if (message.fromUserId !== deps.adminUserId) {
        return;
      }

      await deps.onMessage(message);
    },
  };
}
