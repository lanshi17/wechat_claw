export function createApplication(deps: { sendReply: (userId: string, text: string) => Promise<void> | void }) {
  return {
    async handleAdminMessage(message: { fromUserId: string; text: string; contextToken: string }) {
      await deps.sendReply(message.fromUserId, `Received: ${message.text}`);
    },
  };
}
