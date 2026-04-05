export type ApprovalQueueItem = {
  id: string;
  threadId: string;
  tool: string;
  status: string;
  summary?: string;
  label?: string;
  isSelected?: boolean;
};
