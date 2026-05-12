import { loadConfig } from "../shared/config.js";
import { createWeChatGateway } from "../wechat/gateway.js";
import { createIlinkClient } from "../wechat/ilink-client.js";
import { createIlinkWeChatGateway } from "../wechat/ilink-gateway.js";
import { createAgentRuntime } from "../agent/runtime.js";
import { createToolRegistry } from "../tools/registry.js";
import { createApplication } from "./main.js";
import { createTaskService } from "../tasks/service.js";
import { classifyAction } from "../approval/engine.js";
import { createSqliteDatabase } from "../store/db.js";
import { ThreadRepository } from "../store/repositories/threads.js";
import { ApprovalRepository } from "../store/repositories/approvals.js";
import { createOpenAiProvider } from "../agent/provider/openai.js";
import { createRealShellExec } from "../tools/shell/real-runner.js";
import { createRealFsRead, createRealFsWrite } from "../tools/fs/real-runner.js";
import { createRealWebFetch } from "../tools/web/real-runner.js";
import { pino } from "pino";
import type { MessageInput } from "../tasks/service.js";
import type { InboundWeChatMessage } from "../wechat/types.js";

export function createDefaultEntrypoint(input: { env: Record<string, string | undefined> }) {
  const config = loadConfig(input.env);

  let currentMessage: MessageInput | undefined;
  let currentThreadId: string | undefined;

  const db = createSqliteDatabase(config.databasePath);
  const threadRepository = new ThreadRepository(db);
  const approvalRepository = new ApprovalRepository(db);

  const logger = pino({ level: "info" });
  const contextTokens = new Map<string, string>();

  const ilinkClient = config.ilinkBotToken
    ? createIlinkClient(config.ilinkBotToken)
    : undefined;

  async function sendReply(toUserId: string, text: string) {
    const ctxToken = contextTokens.get(toUserId);
    if (ilinkClient && ctxToken) {
      try {
        await ilinkClient.sendMessage({
          to_user_id: toUserId,
          context_token: ctxToken,
          item_list: [{ type: 1, text_item: { text } }],
        });
        logger.info({ toUserId, text }, "wechat reply sent via ilink");
      } catch (err) {
        logger.error({ toUserId, text, err }, "ilink sendMessage failed");
      }
    } else {
      logger.info({ toUserId, text }, "wechat reply logged (no ilink)");
    }
  }

  const provider = createOpenAiProvider(config.llm);
  const runtime = createAgentRuntime({ provider });
  const toolRegistry = createToolRegistry({
    shellExec: createRealShellExec(config.workspaceRoot),
    fsRead: createRealFsRead(config.workspaceRoot),
    fsWrite: createRealFsWrite(config.workspaceRoot),
    webSearch: async () => ({ items: [] }),
    webFetch: createRealWebFetch(),
    wechatReply: async (input) => {
      await sendReply(input.toUserId, input.text);
      return { delivered: true };
    },
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
          summary: typeof event.summary === "string" ? event.summary : `Event: ${event.kind}`,
        });
      },
      markDone(threadId: string) {
        taskServiceImpl.markDone(threadId);
      },
      markFailed(threadId: string, reason: string) {
        taskServiceImpl.markFailed(threadId, reason);
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
      markRejected(approvalId: string) {
        taskServiceImpl.markRejected(approvalId);
      },
    },
    sendReply,
  });

  const onMessage = async (message: InboundWeChatMessage) => {
    contextTokens.set(message.fromUserId, message.contextToken);
    currentMessage = {
      fromUserId: message.fromUserId,
      text: message.text,
    };
    await app.handleAdminMessage({
      fromUserId: message.fromUserId,
      text: message.text,
      contextToken: message.contextToken,
    });
  };

  const gateway = ilinkClient
    ? createIlinkWeChatGateway({
        adminUserId: config.adminUserId,
        ilinkClient,
        onMessage,
      })
    : createWeChatGateway({
        adminUserId: config.adminUserId,
        onMessage,
      });

  return { app, gateway, taskService: taskServiceImpl, setCurrentMessage: (msg: MessageInput) => { currentMessage = msg; } };
}
