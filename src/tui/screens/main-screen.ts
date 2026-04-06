import type { ApprovalQueueItem } from "../widgets/approval-queue.js";
import type { EventLogItem } from "../widgets/event-log.js";
import type { ThreadItem } from "../widgets/thread-list.js";

export type RejectPromptState = {
  label: string;
  value: string;
};

export type MainScreenState = {
  threadItems: ThreadItem[];
  pendingApprovalCount: number;
  approvalItems: ApprovalQueueItem[];
  eventItems: EventLogItem[];
  recoveryBannerText?: string;
  recoveryHintText?: string;
  footerText: string;
  rejectPrompt?: RejectPromptState;
};
