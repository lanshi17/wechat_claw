import type { ApprovalQueueItem } from "./widgets/approval-queue.js";
import type { ThreadItem } from "./widgets/thread-list.js";

export function buildMainViewModel(input: { threads: Array<{ id: string; title: string; status: string }>; approvals: ApprovalQueueItem[] }) {
  const threadItems: ThreadItem[] = input.threads.map((thread) => ({
    id: thread.id,
    label: `${thread.title} [${thread.status}]`,
  }));

  return {
    threadItems,
    pendingApprovalCount: input.approvals.length,
  };
}
