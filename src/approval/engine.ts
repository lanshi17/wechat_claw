import { approvalRequiredTools } from "./policies.js";

export function classifyAction(action: { tool: string }) {
  if (approvalRequiredTools.has(action.tool)) {
    return { decision: "approval_required" as const };
  }

  return { decision: "auto_approve" as const };
}
