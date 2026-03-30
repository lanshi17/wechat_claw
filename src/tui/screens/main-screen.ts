import type { ApprovalQueueItem } from "../widgets/approval-queue.js";
import type { EventLogItem } from "../widgets/event-log.js";

export type MainScreenState = {
  threadItems: Array<{ id: string; label: string }>;
  pendingApprovalCount: number;
  approvalItems: ApprovalQueueItem[];
  eventItems: EventLogItem[];
};
