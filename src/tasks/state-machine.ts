export type TaskStatus = "queued" | "done";

export type TaskEvent = {
  kind: string;
  summary: string;
};
