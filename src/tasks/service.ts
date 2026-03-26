import { routeThread, type ThreadRecord } from "./thread-router.js";
import type { TaskEvent } from "./state-machine.js";

export type MessageInput = {
  fromUserId: string;
  text: string;
};

export type TaskThread = ThreadRecord;

export function createTaskService() {
  const threads: TaskThread[] = [];
  const events: Map<string, TaskEvent[]> = new Map();

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
  };
}
