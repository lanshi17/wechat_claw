import { loadConfig } from "../shared/config.js";
import { createWeChatGateway } from "../wechat/gateway.js";
import { createAgentRuntime } from "../agent/runtime.js";
import { createToolRegistry } from "../tools/registry.js";
import { createApplication } from "./main.js";
import { createTaskService } from "../tasks/service.js";
import { classifyAction } from "../approval/engine.js";
import type { AgentProvider } from "../agent/provider/base.js";
import type { MessageInput } from "../tasks/service.js";

/**
 * Fake provider for smoke testing: returns deterministic plans without HTTP calls.
 */
function createFakeProvider(): AgentProvider {
  return {
    async plan() {
      return {
        reply: "✓ Tool executed and approval complete!",
        actions: [{ tool: "shell.exec", input: { command: "echo 'smoke test'" } }],
      };
    },
  };
}

async function stubWebSearch() {
  return { items: [] };
}

async function stubShellExec() {
  return {
    exitCode: 0,
    stdout: "",
    stderr: "",
  };
}

export function createDefaultEntrypoint(input: { env: Record<string, string | undefined> }) {
  const config = loadConfig(input.env);

  let currentMessage: MessageInput | undefined;

  const provider = createFakeProvider();
  const runtime = createAgentRuntime({ provider });
  const toolRegistry = createToolRegistry({
    shellExec: stubShellExec,
    webSearch: stubWebSearch,
  });
  const taskServiceImpl = createTaskService();

  const app = createApplication({
    adminUserId: config.adminUserId,
    runtime: {
      async planNext() {
        return runtime.planNext({
          threadId: currentMessage?.text ?? "test",
          prompt: currentMessage?.text ?? "test",
        });
      },
    },
    approvals: { classifyAction },
    tools: toolRegistry,
    taskService: {
      receiveMessage() {
        if (!currentMessage) {
          throw new Error("currentMessage not set before receiveMessage call");
        }
        return taskServiceImpl.receiveMessage(currentMessage);
      },
      appendEvent(threadId: string, event: { kind: string; [key: string]: unknown }) {
        taskServiceImpl.appendEvent(threadId, {
          kind: event.kind,
          summary: `Event: ${event.kind}`,
        });
      },
      markDone(threadId: string) {
        taskServiceImpl.markDone(threadId);
      },
      createApprovalRequest(threadId: string, action: { tool: string; input: unknown }, reply: string) {
        return taskServiceImpl.createApprovalRequest(threadId, action, reply);
      },
      markWaitingApproval(threadId: string) {
        taskServiceImpl.markWaitingApproval(threadId);
      },
      getPendingApproval(approvalId: string) {
        const approval = taskServiceImpl.getPendingApproval(approvalId);
        if (!approval) {
          return {
            id: "",
            threadId: "",
            action: { tool: "", input: {} },
            reply: "",
            status: "pending",
          };
        }
        return approval as { id: string; threadId: string; action: { tool: string; input: unknown }; reply: string; status: string };
      },
      markApproved(approvalId: string) {
        taskServiceImpl.markApproved(approvalId);
      },
    },
    sendReply: async () => {},
  });

  const gateway = createWeChatGateway({
    onMessage: async (message) => {
      currentMessage = {
        fromUserId: message.fromUserId,
        text: message.text,
      };
      await app.handleAdminMessage({
        fromUserId: message.fromUserId,
        text: message.text,
        contextToken: message.contextToken,
      });
    },
  });

  return { app, gateway, taskService: taskServiceImpl, setCurrentMessage: (msg: MessageInput) => { currentMessage = msg; } };
}



