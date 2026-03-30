import { loadConfig } from "../shared/config.js";
import { createWeChatGateway } from "../wechat/gateway.js";
import { createAgentRuntime } from "../agent/runtime.js";
import { createToolRegistry } from "../tools/registry.js";
import { createApplication } from "./main.js";
import { createTaskService } from "../tasks/service.js";
import { classifyAction } from "../approval/engine.js";
import { createSqliteDatabase } from "../store/db.js";
import { ThreadRepository } from "../store/repositories/threads.js";
import { ApprovalRepository } from "../store/repositories/approvals.js";
import { createOpenAiProvider } from "../agent/provider/openai.js";
import type { MessageInput } from "../tasks/service.js";

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
  let currentThreadId: string | undefined;

  const db = createSqliteDatabase(config.databasePath);
  const threadRepository = new ThreadRepository(db);
  const approvalRepository = new ApprovalRepository(db);

  const provider = createOpenAiProvider(config.llm);
  const runtime = createAgentRuntime({ provider });
  const toolRegistry = createToolRegistry({
    shellExec: stubShellExec,
    webSearch: stubWebSearch,
  });
  const taskServiceImpl = createTaskService({
    threadRepository,
    approvalRepository,
  });

  const app = createApplication({
    adminUserId: config.adminUserId,
    runtime: {
      async planNext() {
        if (!currentThreadId) {
          throw new Error("thread not initialized before planning");
        }
        return runtime.planNext({
          threadId: currentThreadId,
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
        const received = taskServiceImpl.receiveMessage(currentMessage);
        currentThreadId = received.threadId;
        return received;
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
        return taskServiceImpl.getPendingApproval(approvalId);
      },
      markApproved(approvalId: string) {
        taskServiceImpl.markApproved(approvalId);
      },
    },
    sendReply: async () => {},
  });

  const gateway = createWeChatGateway({
    adminUserId: config.adminUserId,
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
