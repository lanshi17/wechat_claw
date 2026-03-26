export function createApplication(deps: {
  adminUserId: string;
  runtime: { planNext(): Promise<{ reply: string; actions: Array<{ tool: string; input: unknown }> }> };
  approvals: { classifyAction(action: { tool: string }): { decision: "auto_approve" | "approval_required" } };
  tools: { run(action: { tool: string; input: unknown }): Promise<{ ok: boolean; output: unknown }> };
  taskService: {
    receiveMessage(): { threadId: string };
    appendEvent(threadId: string, event: { kind: string; [key: string]: unknown }): void;
    markDone(threadId: string): void;
  };
  sendReply: (userId: string, text: string) => Promise<void> | void;
}) {
  return {
    async handleAdminMessage(message: { fromUserId: string; text: string; contextToken: string }) {
      // Admin boundary: only trusted admin can trigger orchestration
      if (message.fromUserId !== deps.adminUserId) {
        return;
      }

      // 1. Create/reuse thread
      const { threadId } = deps.taskService.receiveMessage();

      // 2. Ask runtime for plan
      const plan = await deps.runtime.planNext();

      // 3. Process actions
      for (const action of plan.actions) {
        // Auto-approve web.search
        const classification = deps.approvals.classifyAction(action);
        if (classification.decision === "auto_approve") {
          // 4. Run the tool
          const result = await deps.tools.run(action);
          // 5. Append tool.completed event
          deps.taskService.appendEvent(threadId, {
            kind: "tool.completed",
            tool: action.tool,
            result,
          });
        }
      }

      // 6. Mark thread done
      deps.taskService.markDone(threadId);

      // 7. Send final reply
      await deps.sendReply(message.fromUserId, plan.reply);
    },
  };
}
