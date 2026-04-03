import { bootstrapApplication } from "./app/bootstrap.js";

async function main() {
  const env = process.env;

  try {
    const result = await bootstrapApplication({ env });
    console.log("✓ Bootstrap successful");
    console.log(`  Platform: ${result.config.platform}`);
    console.log(`  Workspace: ${result.config.workspaceRoot}`);
    console.log(`  Approval mode: ${result.config.approvalMode}`);

    console.log("\n--- Smoke Flow: Approval Pause & Resume ---");
    console.log("1. Admin sends message...");
    
    let approvalIdFromFlow: string | undefined;
    
    const originalCreateApprovalRequest = result.taskService.createApprovalRequest;
    result.taskService.createApprovalRequest = function(tid: string, action: { tool: string; input: unknown }, reply: string) {
      const approvalResult = originalCreateApprovalRequest.call(this, tid, action, reply);
      approvalIdFromFlow = approvalResult.approvalId;
      console.log(`   ✓ Approval request created: ${approvalResult.approvalId}`);
      console.log(`   Action: ${action.tool}`);
      return approvalResult;
    };

    result.setCurrentMessage({ fromUserId: "wxid_admin", text: "run smoke test" });
    await result.app.handleAdminMessage({ fromUserId: "wxid_admin", text: "run smoke test", contextToken: "ctx1" });
    
    if (!approvalIdFromFlow) {
      throw new Error("No approval was created - smoke flow failed");
    }
    
    const pendingApproval = result.taskService.getPendingApproval(approvalIdFromFlow);
    if (!pendingApproval) {
      throw new Error("Could not retrieve pending approval");
    }
    
    console.log("\n2. Approval required, action paused");
    console.log(`   Approval ID: ${approvalIdFromFlow}`);
    console.log(`   Status: ${pendingApproval.status}`);
    console.log(`   Tool: ${pendingApproval.action.tool}`);
    console.log(`   Thread: ${pendingApproval.threadId}`);
    
    console.log("\n3. Admin approves via CLI...");
    result.taskService.markApproved(approvalIdFromFlow);
    console.log(`   ✓ Marked approval as approved`);
    
    console.log("\n4. Resuming execution...");
    await result.app.resumeApproval(approvalIdFromFlow);
    console.log(`   ✓ Resumed and executed`);
    
    const finalThread = result.taskService.getThread(pendingApproval.threadId);
    if (finalThread) {
      console.log(`   Final thread status: ${finalThread.status}`);
    } else {
      console.log(`   Thread not found (using hardcoded smoke-test threadId)`);
    }
    
    console.log("\n✓ Approval-resume smoke flow completed successfully");
    process.exit(0);
  } catch (error) {
    if (error instanceof Error) {
      console.error("✗ Bootstrap failed:", error.message);
    } else {
      console.error("✗ Bootstrap failed:", String(error));
    }
    process.exit(1);
  }
}

main();



