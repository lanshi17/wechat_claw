import type { ApprovalQueueItem } from "./widgets/approval-queue.js";
import type { EventLogItem } from "./widgets/event-log.js";
import type { ThreadItem } from "./widgets/thread-list.js";
import type { MainScreenState } from "./screens/main-screen.js";

type InteractionState = {
  mode: "browse" | "reject_input";
  selectedApprovalIndex: number;
  rejectReason: string;
};

function clampSelection(index: number, approvals: ApprovalQueueItem[]) {
  if (approvals.length === 0) {
    return 0;
  }

  return Math.min(Math.max(index, 0), approvals.length - 1);
}

function buildApprovalLabel(approval: ApprovalQueueItem, isSelected: boolean) {
  const marker = isSelected ? ">" : " ";
  const summary = approval.summary ? ` - ${approval.summary}` : "";
  return `${marker} [${approval.status}] ${approval.tool}${summary}`;
}

export function buildMainViewModel(input: {
  threads: Array<{ id: string; title: string; status: string; latestEventSummary?: string }>;
  approvals: ApprovalQueueItem[];
  eventsByThread?: Record<string, EventLogItem[]>;
  interaction?: InteractionState;
}): MainScreenState {
  const interaction = input.interaction ?? {
    mode: "browse",
    selectedApprovalIndex: 0,
    rejectReason: "",
  };
  const selectedApprovalIndex = clampSelection(interaction.selectedApprovalIndex, input.approvals);
  const selectedThreadId = input.approvals[selectedApprovalIndex]?.threadId;

  const threadItems: ThreadItem[] = input.threads.map((thread) => ({
    id: thread.id,
    label: thread.latestEventSummary
      ? `${thread.title} [${thread.status}] - ${thread.latestEventSummary}`
      : `${thread.title} [${thread.status}]`,
    isSelected: selectedThreadId !== undefined && thread.id === selectedThreadId,
  }));
  const approvalItems = input.approvals.map((approval, index) => {
    const isSelected = index === selectedApprovalIndex;
    return {
      ...approval,
      label: buildApprovalLabel(approval, isSelected),
      isSelected,
    };
  });
  const eventItems = selectedThreadId ? (input.eventsByThread?.[selectedThreadId] ?? []) : [];
  const footerText = interaction.mode === "reject_input"
    ? "Enter to reject, Esc to cancel, Backspace to edit"
    : input.approvals.length === 0
      ? "No approvals available. Press q to quit."
      : "j/k or arrows move, a approves, r rejects, q quits";

  return {
    threadItems,
    pendingApprovalCount: input.approvals.filter((approval) => approval.status === "pending").length,
    approvalItems,
    eventItems,
    footerText,
    rejectPrompt: interaction.mode === "reject_input"
      ? {
          label: "Reject reason",
          value: interaction.rejectReason,
        }
      : undefined,
  };
}

export function renderMainScreen(state: MainScreenState) {
  const lines = [
    "Threads",
    ...state.threadItems.map((thread) => `${thread.isSelected ? "*" : " "} ${thread.label}`),
    "",
    `Approvals (${state.pendingApprovalCount} pending)`,
    ...(state.approvalItems.length > 0
      ? state.approvalItems.map((approval) => approval.label ?? `  [${approval.status}] ${approval.tool}`)
      : ["  (none)"]),
    "",
    "Events",
    ...(state.eventItems.length > 0
      ? state.eventItems.map((event) => `- ${event.summary}`)
      : ["  (none)"]),
    "",
    state.footerText,
  ];

  if (state.rejectPrompt) {
    lines.push(`${state.rejectPrompt.label}: ${state.rejectPrompt.value}`);
  }

  return lines.join("\n");
}
