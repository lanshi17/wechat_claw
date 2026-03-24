import { routeThread, type ThreadRecord } from "./thread-router.js";

export type MessageInput = {
  fromUserId: string;
  text: string;
};

export type TaskThread = ThreadRecord;

export function createTaskService() {
  const threads: TaskThread[] = [];

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
  };
}
