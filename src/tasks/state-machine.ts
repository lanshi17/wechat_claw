export type TaskStatus = "queued" | "done" | "waiting_approval" | "failed";

export type TaskEvent = {
  kind: string;
  summary: string;
};

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type ApprovalRecord = {
  id: string;
  threadId: string;
  action: { tool: string; input: unknown };
  reply: string;
  status: ApprovalStatus;
};
