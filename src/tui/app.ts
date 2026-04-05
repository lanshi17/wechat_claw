import type { ApprovalQueueItem } from "./widgets/approval-queue.js";
import type { EventLogItem } from "./widgets/event-log.js";
import type { ThreadItem } from "./widgets/thread-list.js";

export function buildMainViewModel(input: {
  threads: Array<{ id: string; title: string; status: string; latestEventSummary?: string }>;
  approvals: ApprovalQueueItem[];
  events?: EventLogItem[];
}) {
  const threadItems: ThreadItem[] = input.threads.map((thread) => ({
    id: thread.id,
    label: thread.latestEventSummary
      ? `${thread.title} [${thread.status}] - ${thread.latestEventSummary}`
      : `${thread.title} [${thread.status}]`,
  }));

  return {
    threadItems,
    pendingApprovalCount: input.approvals.filter((approval) => approval.status === "pending").length,
    approvalItems: input.approvals,
    eventItems: input.events ?? [],
  };
}
