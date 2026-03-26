import { loadConfig } from "../shared/config.js";
import { createWeChatGateway } from "../wechat/gateway.js";
import { createAgentRuntime } from "../agent/runtime.js";
import { createToolRegistry } from "../tools/registry.js";
import { createApplication } from "./main.js";
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
        reply: "Got it! I'll help you with that.",
        actions: [],
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

  const app = createApplication({
    adminUserId: config.adminUserId,
    runtime: {
      async planNext() {
        return runtime.planNext({
          threadId: "smoke-test",
          prompt: currentMessage?.text ?? "test",
        });
      },
    },
    approvals: { classifyAction },
    tools: toolRegistry,
    taskService: {
      receiveMessage() {
        return { threadId: "smoke-test" };
      },
      appendEvent() {},
      markDone() {},
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

  return { app, gateway };
}
