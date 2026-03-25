# OpenAI-Compatible Provider Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current provider-name-based LLM configuration with a single OpenAI-compatible configuration model that supports custom base URLs, custom model names, an optional API key, and explicit image capability settings.

**Architecture:** Keep the existing `src/shared` configuration boundary and the `src/agent/provider` abstraction, but remove the old provider-name-based env model as a user-facing concept. Normalize configuration into one `openai-compatible` provider shape, update tests first, then update docs and any provider wiring that still depends on provider-brand semantics.

**Tech Stack:** Node.js, TypeScript, Zod, Vitest.

---

### Task 1: Rewrite config tests for the new environment model

**Files:**
- Modify: `tests/shared/config.test.ts`
- Check: `src/shared/config.ts`
- Check: `src/shared/schema.ts`

**Step 1: Write the failing test**

Replace the current test with coverage for the new environment model. The new test should assert:

```ts
import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/shared/config.js";

describe("loadConfig", () => {
  it("loads an OpenAI-compatible provider config", () => {
    const cfg = loadConfig({
      ADMIN_USER_ID: "wxid_admin",
      WORKSPACE_ROOT: "/workspace",
      DATABASE_PATH: "./data/app.db",
      LLM_BASE_URL: "http://localhost:11434/v1",
      LLM_MODEL: "qwen2.5-coder",
      LLM_API_KEY: "secret",
      LLM_SUPPORTS_IMAGE_INPUT: "true",
    });

    expect(cfg.adminUserId).toBe("wxid_admin");
    expect(cfg.llm.apiStyle).toBe("openai-compatible");
    expect(cfg.llm.baseUrl).toBe("http://localhost:11434/v1");
    expect(cfg.llm.model).toBe("qwen2.5-coder");
    expect(cfg.llm.apiKey).toBe("secret");
    expect(cfg.llm.supportsImageInput).toBe(true);
  });

  it("defaults imageInput to false when not provided", () => {
    const cfg = loadConfig({
      ADMIN_USER_ID: "wxid_admin",
      WORKSPACE_ROOT: "/workspace",
      DATABASE_PATH: "./data/app.db",
      LLM_BASE_URL: "http://localhost:11434/v1",
      LLM_MODEL: "qwen2.5-coder",
    });

    expect(cfg.llm.supportsImageInput).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/shared/config.test.ts`
Expected: FAIL because `LLM_BASE_URL`, `LLM_API_KEY`, and `LLM_SUPPORTS_IMAGE_INPUT` are not yet supported and `cfg.llm.apiStyle` does not exist.

**Step 3: Write minimal implementation**

Do not implement yet beyond what is needed in Task 2. This task exists to lock the desired config contract first.

**Step 4: Run test to verify failure quality**

Run: `npx vitest run tests/shared/config.test.ts`
Expected: still FAIL, but for the intended missing-config-shape reasons.

**Step 5: Commit**

```bash
git add tests/shared/config.test.ts
git commit -m "test: define openai-compatible config contract"
```

---

### Task 2: Replace schema and config loading with the unified provider shape

**Files:**
- Modify: `src/shared/schema.ts`
- Modify: `src/shared/config.ts`
- Test: `tests/shared/config.test.ts`

**Step 1: Write the failing test**

Use the tests from Task 1 as the failing contract.

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/shared/config.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**

Update `src/shared/schema.ts` to:

- remove the old provider-name env variable
- require `LLM_BASE_URL`
- require `LLM_MODEL`
- keep `DATABASE_PATH`
- add optional `LLM_API_KEY`
- add optional `LLM_SUPPORTS_IMAGE_INPUT`

Update `src/shared/config.ts` to return:

```ts
return {
  adminUserId: parsed.ADMIN_USER_ID,
  workspaceRoot: parsed.WORKSPACE_ROOT,
  databasePath: parsed.DATABASE_PATH,
  llm: {
    apiStyle: "openai-compatible",
    baseUrl: parsed.LLM_BASE_URL,
    model: parsed.LLM_MODEL,
    apiKey: parsed.LLM_API_KEY,
    supportsImageInput: parsed.LLM_SUPPORTS_IMAGE_INPUT === "true",
  },
};
```

If `LLM_SUPPORTS_IMAGE_INPUT` is parsed from a string, make the parsing explicit and deterministic.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/shared/config.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/shared/schema.ts src/shared/config.ts tests/shared/config.test.ts
git commit -m "feat: add openai-compatible provider config"
```

---

### Task 3: Remove provider-brand assumptions from the provider layer

**Files:**
- Modify: `src/agent/provider/openai.ts`
- Modify or remove references in: `src/agent/provider/ollama.ts`
- Check: `src/agent/provider/base.ts`
- Search: `src/` and `tests/` for the old provider env variable, `provider.type`, and `ollama`

**Step 1: Write the failing test**

If a provider-specific test file exists, add a minimal test. If none exists, create one:

- Create: `tests/agent/provider-config.test.ts`

The test should verify that the codebase no longer depends on `provider.type` for runtime provider selection semantics and that the OpenAI-compatible provider factory accepts normalized config.

A minimal contract example:

```ts
import { describe, expect, it } from "vitest";
import { createOpenAiProvider } from "../../src/agent/provider/openai.js";

const config = {
  apiStyle: "openai-compatible" as const,
  baseUrl: "http://localhost:11434/v1",
  model: "qwen2.5-coder",
  apiKey: undefined,
  supportsImageInput: false,
};

describe("createOpenAiProvider", () => {
  it("keeps the MVP provider path openai-compatible", async () => {
    const provider = createOpenAiProvider(config, {
      plan: async () => ({ reply: "ok", actions: [] }),
    });

    expect(provider).toBeDefined();
    expect(provider.config).toEqual(config);
  });
});
```

If the current provider factory shape makes this exact test unsuitable, adjust the test to match the real desired constructor signature — but keep the focus on normalized OpenAI-compatible semantics, not provider brand names.

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/agent/provider-config.test.ts`
Expected: FAIL because current provider wrappers do not yet reflect the new config semantics.

**Step 3: Write minimal implementation**

- Make `src/agent/provider/openai.ts` the single active OpenAI-compatible provider path for the MVP.
- Remove any meaningful runtime reliance on `ollama` as a separate provider identity.
- Avoid overbuilding a full HTTP client if the current repository still uses a stubbed provider path; the goal is semantic convergence and normalized wiring, not premature production integration.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/agent/provider-config.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/agent/provider/openai.ts src/agent/provider/ollama.ts tests/agent/provider-config.test.ts
git commit -m "refactor: unify provider wiring around openai-compatible config"
```

---

### Task 4: Update repository documentation and example environment file

**Files:**
- Modify: `README.md`
- Modify: `.env.example`
- Reference: `docs/plans/2026-03-25-openai-compatible-provider-design.md`

**Step 1: Write the failing doc expectation**

Define the required replacements:

- `README.md` must stop documenting the old provider-name env variable
- `README.md` must document `LLM_BASE_URL`, `LLM_MODEL`, optional `LLM_API_KEY`, and optional `LLM_SUPPORTS_IMAGE_INPUT`
- `.env.example` must use the new variable names

**Step 2: Run verification to confirm docs are outdated**

Run: `grep -n "LLM_MODEL\|LLM_BASE_URL\|LLM_API_KEY\|LLM_SUPPORTS_IMAGE_INPUT" README.md .env.example`
Expected: output does not yet fully show the new model.

**Step 3: Write minimal implementation**

Update `README.md` and `.env.example` so they document only the new OpenAI-compatible configuration model.

Recommended `.env.example` result:

```env
ADMIN_USER_ID=wxid_admin
WORKSPACE_ROOT=/workspace
DATABASE_PATH=./data/wechat-claw.db
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=qwen2.5-coder
LLM_API_KEY=
LLM_SUPPORTS_IMAGE_INPUT=false
```

**Step 4: Run verification to confirm docs are updated**

Run: `grep -n "LLM_MODEL\|LLM_BASE_URL\|LLM_API_KEY\|LLM_SUPPORTS_IMAGE_INPUT" README.md .env.example`
Expected: all new variables are documented.

**Step 5: Commit**

```bash
git add README.md .env.example
git commit -m "docs: update env setup for openai-compatible provider"
```

---

### Task 5: Run final verification for the migration slice

**Files:**
- Verify: `src/shared/schema.ts`
- Verify: `src/shared/config.ts`
- Verify: `src/agent/provider/openai.ts`
- Verify: `src/agent/provider/ollama.ts`
- Verify: `tests/shared/config.test.ts`
- Verify: `tests/agent/provider-config.test.ts`
- Verify: `README.md`
- Verify: `.env.example`

**Step 1: Run focused tests**

Run: `npx vitest run tests/shared/config.test.ts tests/agent/provider-config.test.ts`
Expected: PASS.

**Step 2: Run full test suite**

Run: `npx vitest run`
Expected: PASS, or clearly identify unrelated pre-existing failures.

**Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

**Step 4: Verify docs use only the new variables**

Run: `grep -R "LLM_BASE_URL\|LLM_API_KEY\|LLM_SUPPORTS_IMAGE_INPUT" src tests README.md .env.example`
Expected: the active code/docs path uses the new variables.

**Step 5: Commit verification note**

No new commit is required if all previous tasks were committed cleanly; otherwise create a final cleanup commit only if verification uncovered a missing migration fix.
