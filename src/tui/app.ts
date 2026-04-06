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

function buildRecoveryState(input: {
  threads: Array<{ status: string }>;
  pendingApprovalCount: number;
}) {
  if (input.pendingApprovalCount > 0) {
    return {
      recoveryBannerText: "Recovered pending approvals from the previous run.",
      recoveryHintText: "Approve or reject a recovered approval to continue.",
    };
  }

  if (input.threads.some((thread) => thread.status === "waiting_approval")) {
    return {
      recoveryBannerText: "Recovered waiting threads from the previous run.",
      recoveryHintText: "Recovered context only. No approval action is available.",
    };
  }

  if (input.threads.some((thread) => thread.status === "failed")) {
    return {
      recoveryBannerText: "Recovered failed threads from the previous run.",
      recoveryHintText: "Recovered context only. No approval action is available.",
    };
  }

  return undefined;
}

export function buildMainViewModel(input: {
  threads: Array<{ id: string; title: string; status: string; latestEventSummary?: string }>;
  approvals: ApprovalQueueItem[];
  eventsByThread?: Record<string, EventLogItem[]>;
  selectedThreadId?: string;
  interaction?: InteractionState;
}): MainScreenState {
  const interaction = input.interaction ?? {
    mode: "browse",
    selectedApprovalIndex: 0,
    rejectReason: "",
  };
  const selectedApprovalIndex = clampSelection(interaction.selectedApprovalIndex, input.approvals);
  const selectedThreadId = input.selectedThreadId ?? input.approvals[selectedApprovalIndex]?.threadId;
  const pendingApprovalCount = input.approvals.filter((approval) => approval.status === "pending").length;
  const recoveryState = buildRecoveryState({
    threads: input.threads,
    pendingApprovalCount,
  });

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
    : pendingApprovalCount > 0
      ? "j/k or arrows move, a approves, r rejects, q quits"
      : recoveryState
        ? "Recovered context only. Press q to quit."
        : input.approvals.length === 0
      ? "No approvals available. Press q to quit."
      : "No pending approvals. Press q to quit.";

  return {
    threadItems,
    pendingApprovalCount,
    approvalItems,
    eventItems,
    recoveryBannerText: recoveryState?.recoveryBannerText,
    recoveryHintText: recoveryState?.recoveryHintText,
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
    ...(state.recoveryBannerText ? [state.recoveryBannerText] : []),
    ...(state.recoveryHintText ? [state.recoveryHintText, ""] : []),
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
