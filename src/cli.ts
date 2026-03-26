import { bootstrapApplication } from "./app/bootstrap.js";

async function main() {
  const env = process.env;

  try {
    const result = await bootstrapApplication({ env });
    console.log("✓ Bootstrap successful");
    console.log(`  Platform: ${result.config.platform}`);
    console.log(`  Workspace: ${result.config.workspaceRoot}`);
    console.log(`  Approval mode: ${result.config.approvalMode}`);
    console.log("✓ Application and gateway ready");
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


