import type { InboundWeChatMessage } from "./types.js";
import type { createIlinkClient } from "./ilink-client.js";

type IlinkClient = ReturnType<typeof createIlinkClient>;

export function createIlinkWeChatGateway(deps: {
  adminUserId: string;
  ilinkClient: IlinkClient;
  onMessage: (message: InboundWeChatMessage) => Promise<void> | void;
}) {
  const contextTokens = new Map<string, string>();
  let polling = false;
  let getUpdatesBuf = "";

  async function poll() {
    while (polling) {
      try {
        const result = await deps.ilinkClient.getUpdates(getUpdatesBuf);
        getUpdatesBuf = result.get_updates_buf ?? getUpdatesBuf;

        for (const msg of result.msgs ?? []) {
          if (msg.message_type !== 1) continue;

          const textItem = msg.item_list?.[0];
          const text = textItem?.text_item?.text ?? "";
          if (!text) continue;

          contextTokens.set(msg.from_user_id, msg.context_token);

          const inbound: InboundWeChatMessage = {
            fromUserId: msg.from_user_id,
            text,
            contextToken: msg.context_token,
          };

          if (inbound.fromUserId === deps.adminUserId) {
            await deps.onMessage(inbound);
          } else {
            console.log(`[ilink] ignored message from non-admin user: ${inbound.fromUserId} (text: ${inbound.text.slice(0, 50)})`);
          }
        }
      } catch (_err) {
        // Polling error — wait briefly and retry
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }

  return {
    start() {
      polling = true;
      poll();
    },

    stop() {
      polling = false;
    },

    handleInbound(message: InboundWeChatMessage) {
      contextTokens.set(message.fromUserId, message.contextToken);
      return deps.onMessage(message);
    },

    getContextToken(userId: string): string | undefined {
      return contextTokens.get(userId);
    },
  };
}
