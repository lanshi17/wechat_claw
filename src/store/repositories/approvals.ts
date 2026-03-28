import type Database from "better-sqlite3";
import type { ApprovalStatus } from "../../tasks/state-machine.js";

export type ApprovalAction = {
  tool: string;
  input: unknown;
};

export type ApprovalInput = {
  threadId: string;
  action: ApprovalAction;
  reply: string;
};

export type ApprovalRecord = {
  id: string;
  threadId: string;
  status: ApprovalStatus;
  action: ApprovalAction;
  reply: string;
};

export class ApprovalRepository {
  constructor(private readonly db: Database.Database) {}

  create(input: ApprovalInput): ApprovalRecord {
    const approval: ApprovalRecord = {
      id: crypto.randomUUID(),
      threadId: input.threadId,
      status: "pending",
      action: input.action,
      reply: input.reply,
    };

    this.db
      .prepare(
        "INSERT INTO approval_requests (id, thread_id, status, action, reply) VALUES (?, ?, ?, ?, ?)"
      )
      .run(
        approval.id,
        approval.threadId,
        approval.status,
        JSON.stringify(approval.action),
        approval.reply
      );

    return approval;
  }

  get(approvalId: string): ApprovalRecord | undefined {
    const row = this.db
      .prepare(
        "SELECT id, thread_id, status, action, reply FROM approval_requests WHERE id = ?"
      )
      .get(approvalId) as
      | { id: string; thread_id: string; status: string; action: string; reply: string }
      | undefined;

    if (!row) {
      return undefined;
    }

    return {
      id: row.id,
      threadId: row.thread_id,
      status: row.status as ApprovalStatus,
      action: JSON.parse(row.action) as ApprovalAction,
      reply: row.reply,
    };
  }

  markApproved(approvalId: string): void {
    this.db
      .prepare("UPDATE approval_requests SET status = ? WHERE id = ?")
      .run("approved", approvalId);
  }
}
