import type { InboundWeChatMessage } from "./types.js";

export function createWeChatGateway(deps: { onMessage: (message: InboundWeChatMessage) => Promise<void> | void }) {
  return {
    async handleInbound(message: InboundWeChatMessage) {
      await deps.onMessage(message);
    },
  };
}
