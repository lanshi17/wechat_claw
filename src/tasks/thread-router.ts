import type { TaskStatus } from "./state-machine.js";

export type ThreadRouteRecord = {
  id: string;
  fromUserId: string;
  status: TaskStatus;
};

export type ThreadRecord = ThreadRouteRecord & {
  title: string;
};

export function routeThread<T extends ThreadRouteRecord>(threads: T[], fromUserId: string): T | undefined {
  return [...threads].reverse().find((thread) => thread.fromUserId === fromUserId && thread.status !== "done");
}
