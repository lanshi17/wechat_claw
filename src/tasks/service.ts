import { routeThread, type ThreadRecord } from "./thread-router.js";
import type { TaskEvent, ApprovalRecord } from "./state-machine.js";

export type MessageInput = {
  fromUserId: string;
  text: string;
};

export type TaskThread = ThreadRecord;

export function createTaskService() {
  const threads: TaskThread[] = [];
  const events: Map<string, TaskEvent[]> = new Map();
  const approvals: Map<string, ApprovalRecord> = new Map();

  return {
    receiveMessage(input: MessageInput) {
      const existing = routeThread(threads, input.fromUserId);

      if (existing) {
        return { threadId: existing.id };
      }

      const thread: TaskThread = {
        id: crypto.randomUUID(),
        fromUserId: input.fromUserId,
        status: "queued",
      };

      threads.push(thread);
      return { threadId: thread.id };
    },
    getThread(threadId: string) {
      return threads.find((thread) => thread.id === threadId);
    },
    appendEvent(threadId: string, event: TaskEvent) {
      if (!events.has(threadId)) {
        events.set(threadId, []);
      }
      events.get(threadId)!.push(event);
    },
    listEvents(threadId: string) {
      return events.get(threadId) ?? [];
    },
    markDone(threadId: string) {
      const thread = threads.find((t) => t.id === threadId);
      if (thread) {
        thread.status = "done";
      }
    },
    createApprovalRequest(threadId: string, action: { tool: string; input: unknown }, reply: string) {
      const approvalId = crypto.randomUUID();
      const approval: ApprovalRecord = {
        id: approvalId,
        threadId,
        action,
        reply,
        status: "pending",
      };
      approvals.set(approvalId, approval);
      return { approvalId };
    },
    markWaitingApproval(threadId: string) {
      const thread = threads.find((t) => t.id === threadId);
      if (thread) {
        thread.status = "waiting_approval";
      }
    },
    getPendingApproval(approvalId: string) {
      return approvals.get(approvalId);
    },
    markApproved(approvalId: string) {
      const approval = approvals.get(approvalId);
      if (approval) {
        approval.status = "approved";
      }
    },
  };
}
