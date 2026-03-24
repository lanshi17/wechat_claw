import type { TaskStatus } from "./state-machine.js";

export type ThreadRecord = {
  id: string;
  fromUserId: string;
  status: TaskStatus;
};

export function routeThread(threads: ThreadRecord[], fromUserId: string): ThreadRecord | undefined {
  return [...threads].reverse().find((thread) => thread.fromUserId === fromUserId && thread.status === "queued");
}
