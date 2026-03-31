import { routeThread, type ThreadRecord } from "./thread-router.js";
import type { TaskEvent, ApprovalRecord } from "./state-machine.js";
import type { ThreadRepository } from "../store/repositories/threads.js";
import type { ApprovalRepository } from "../store/repositories/approvals.js";

export type MessageInput = {
  fromUserId: string;
  text: string;
};

export type TaskThread = ThreadRecord;

export type TaskServiceDeps = {
  threadRepository?: ThreadRepository;
  approvalRepository?: ApprovalRepository;
};

export function createTaskService({
  threadRepository,
  approvalRepository,
}: TaskServiceDeps = {}) {
  const threads: TaskThread[] = [];
  const events: Map<string, TaskEvent[]> = new Map();
  const approvals: Map<string, ApprovalRecord> = new Map();

  return {
    receiveMessage(input: MessageInput) {
      const existing = routeThread(threads, input.fromUserId);

      if (existing) {
        return { threadId: existing.id };
      }

      if (threadRepository) {
        const persisted = routeThread(
          threadRepository.listBySourceUserId(input.fromUserId).map((thread) => ({
            id: thread.id,
            fromUserId: thread.sourceUserId,
            status: thread.status,
          })),
          input.fromUserId,
        );

        if (persisted) {
          return { threadId: persisted.id };
        }
      }

      let threadId: string;

      if (threadRepository) {
        const created = threadRepository.create({
          sourceUserId: input.fromUserId,
          title: input.text,
        });
        threadId = created.id;
      } else {
        threadId = crypto.randomUUID();
      }

      const thread: TaskThread = {
        id: threadId,
        fromUserId: input.fromUserId,
        status: "queued",
      };

      threads.push(thread);
      return { threadId };
    },
    getThread(threadId: string) {
      const local = threads.find((thread) => thread.id === threadId);
      if (local) {
        return local;
      }

      if (!threadRepository) {
        return undefined;
      }

      const persisted = threadRepository.get(threadId);
      if (!persisted) {
        return undefined;
      }

      return {
        id: persisted.id,
        fromUserId: persisted.sourceUserId,
        status: persisted.status,
      };
    },
    appendEvent(threadId: string, event: TaskEvent) {
      if (!events.has(threadId)) {
        events.set(threadId, []);
      }
      events.get(threadId)!.push(event);

      if (threadRepository) {
        threadRepository.appendEvent(threadId, event);
      }
    },
    listEvents(threadId: string) {
      return events.get(threadId) ?? [];
    },
    markDone(threadId: string) {
      const thread = threads.find((t) => t.id === threadId);
      if (thread) {
        thread.status = "done";
      }

      if (threadRepository) {
        threadRepository.updateStatus(threadId, "done");
      }
    },
    createApprovalRequest(threadId: string, action: { tool: string; input: unknown }, reply: string) {
      let approvalId: string;

      if (approvalRepository) {
        const created = approvalRepository.create({
          threadId,
          action,
          reply,
        });
        approvalId = created.id;
        approvals.set(created.id, created);
      } else {
        approvalId = crypto.randomUUID();
        approvals.set(approvalId, {
          id: approvalId,
          threadId,
          action,
          reply,
          status: "pending",
        });
      }

      return { approvalId };
    },
    markWaitingApproval(threadId: string) {
      const thread = threads.find((t) => t.id === threadId);
      if (thread) {
        thread.status = "waiting_approval";
      }

      if (threadRepository) {
        threadRepository.updateStatus(threadId, "waiting_approval");
      }
    },
    getPendingApproval(approvalId: string) {
      if (approvalRepository) {
        const approval = approvalRepository.get(approvalId);
        if (approval) {
          approvals.set(approvalId, approval);
        }
        return approval;
      }

      return approvals.get(approvalId);
    },
    markApproved(approvalId: string) {
      const approval = approvals.get(approvalId);
      if (approval) {
        approval.status = "approved";
      }

      if (approvalRepository) {
        approvalRepository.markApproved(approvalId);
      }
    },
  };
}
