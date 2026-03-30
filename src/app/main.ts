export function createApplication(deps: {
  adminUserId: string;
  runtime: { planNext(): Promise<{ reply: string; actions: Array<{ tool: string; input: unknown }> }> };
  approvals: { classifyAction(action: { tool: string }): { decision: "auto_approve" | "approval_required" } };
  tools: { run(action: { tool: string; input: unknown }): Promise<{ ok: boolean; output: unknown }> };
  taskService: {
    receiveMessage(): { threadId: string };
    appendEvent(threadId: string, event: { kind: string; [key: string]: unknown }): void;
    markDone(threadId: string): void;
    createApprovalRequest?(threadId: string, action: { tool: string; input: unknown }, reply: string): { approvalId: string };
    markWaitingApproval?(threadId: string): void;
    getPendingApproval?(approvalId: string):
      | { id: string; threadId: string; action: { tool: string; input: unknown }; reply: string; status: string }
      | undefined;
    markApproved?(approvalId: string): void;
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
        const classification = deps.approvals.classifyAction(action);
        if (classification.decision === "auto_approve") {
          const result = await deps.tools.run(action);
          deps.taskService.appendEvent(threadId, {
            kind: "tool.completed",
            tool: action.tool,
            result,
          });
        } else if (classification.decision === "approval_required") {
          if (deps.taskService.createApprovalRequest && deps.taskService.markWaitingApproval) {
            const approval = deps.taskService.createApprovalRequest(threadId, action, plan.reply);
            deps.taskService.markWaitingApproval(threadId);
            await deps.sendReply(message.fromUserId, `Action requires approval. Approval ID: ${approval.approvalId}`);
            return;
          }
        }
      }

      // 6. Mark thread done
      deps.taskService.markDone(threadId);

      // 7. Send final reply
      await deps.sendReply(message.fromUserId, plan.reply);
    },

    async resumeApproval(approvalId: string) {
      if (!deps.taskService.getPendingApproval || !deps.taskService.markApproved) {
        return;
      }

      const approval = deps.taskService.getPendingApproval(approvalId);
      if (!approval) return;

      const { threadId, action, reply } = approval;
      deps.taskService.markApproved(approvalId);

      const result = await deps.tools.run(action);
      deps.taskService.appendEvent(threadId, {
        kind: "tool.completed",
        tool: action.tool,
        result,
      });

      deps.taskService.markDone(threadId);
      await deps.sendReply(deps.adminUserId, reply);
    },
  };
}
