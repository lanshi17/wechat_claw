import type { ApprovalQueueItem } from "./widgets/approval-queue.js";

export type TuiMode = "browse" | "reject_input";

export type TuiControllerState = {
  mode: TuiMode;
  selectedApprovalIndex: number;
  rejectReason: string;
};

export type TuiInput =
  | { kind: "up" }
  | { kind: "down" }
  | { kind: "approve" }
  | { kind: "reject" }
  | { kind: "submit" }
  | { kind: "escape" }
  | { kind: "backspace" }
  | { kind: "char"; value: string };

type TuiAppActions = {
  resumeApproval(approvalId: string): Promise<void> | void;
  rejectApproval(approvalId: string, reason?: string): Promise<void> | void;
};

function clampSelection(index: number, approvals: ApprovalQueueItem[]) {
  if (approvals.length === 0) {
    return 0;
  }

  return Math.min(Math.max(index, 0), approvals.length - 1);
}

function isPendingApproval(approval: ApprovalQueueItem | undefined) {
  return approval?.status === "pending";
}

export function createTuiController(input: { app: TuiAppActions }) {
  const state: TuiControllerState = {
    mode: "browse",
    selectedApprovalIndex: 0,
    rejectReason: "",
  };

  const getSelectedApproval = (approvals: ApprovalQueueItem[]) => {
    if (approvals.length === 0) {
      return undefined;
    }

    return approvals[clampSelection(state.selectedApprovalIndex, approvals)];
  };

  const resetRejectInput = () => {
    state.mode = "browse";
    state.rejectReason = "";
  };

  const syncSelection = (approvals: ApprovalQueueItem[]) => {
    state.selectedApprovalIndex = clampSelection(state.selectedApprovalIndex, approvals);

    if (approvals.length === 0 && state.mode === "reject_input") {
      resetRejectInput();
    }
  };

  return {
    getState(): TuiControllerState {
      return { ...state };
    },
    setApprovalItems(approvals: ApprovalQueueItem[]) {
      syncSelection(approvals);
      return this.getState();
    },
    async handleInput(inputEvent: TuiInput, approvals: ApprovalQueueItem[]) {
      syncSelection(approvals);

      if (state.mode === "reject_input") {
        if (inputEvent.kind === "escape") {
          resetRejectInput();
          return this.getState();
        }

        if (inputEvent.kind === "backspace") {
          state.rejectReason = state.rejectReason.slice(0, -1);
          return this.getState();
        }

        if (inputEvent.kind === "char") {
          state.rejectReason += inputEvent.value;
          return this.getState();
        }

        if (inputEvent.kind === "submit") {
          const approval = getSelectedApproval(approvals);
          if (isPendingApproval(approval)) {
            const reason = state.rejectReason || undefined;
            await input.app.rejectApproval(approval.id, reason);
          }
          resetRejectInput();
          return this.getState();
        }

        return this.getState();
      }

      switch (inputEvent.kind) {
        case "down":
          state.selectedApprovalIndex = clampSelection(state.selectedApprovalIndex + 1, approvals);
          break;
        case "up":
          state.selectedApprovalIndex = clampSelection(state.selectedApprovalIndex - 1, approvals);
          break;
        case "approve": {
          const approval = getSelectedApproval(approvals);
          if (isPendingApproval(approval)) {
            await input.app.resumeApproval(approval.id);
          }
          break;
        }
        case "reject": {
          const approval = getSelectedApproval(approvals);
          if (isPendingApproval(approval)) {
            state.mode = "reject_input";
            state.rejectReason = "";
          }
          break;
        }
        default:
          break;
      }

      return this.getState();
    },
  };
}
