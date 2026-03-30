# Real HTTP Provider Smoke Slice Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the fake OpenAI-compatible provider with a real HTTP-backed provider while keeping the existing smoke flow, approval-resume behavior, and SQLite-backed state intact.

**Architecture:** Keep the current app/runtime/provider contract unchanged and swap only the provider internals from fake planning to real `/chat/completions` calls. Preserve `start:mvp`, the approval pause/resume smoke path, and SQLite-backed task state while adding focused provider tests around request building, response mapping, and explicit provider errors.

**Tech Stack:** TypeScript, Vitest, Zod-based config, existing OpenAI-compatible config model, Node fetch-compatible HTTP calls, current runtime/app/task/store layers.

---

### Task 1: Define the real provider contract with failing tests

**Files:**
- Modify: `tests/agent/runtime.test.ts`
- Create: `tests/agent/provider/openai.test.ts`
- Modify: `src/agent/provider/base.ts` (only if test-driven adjustments are required)

**Step 1: Write the failing test**

Add focused provider tests that express the contract without changing production code first.

```ts
describe("createOpenAiProvider", () => {
  it("calls the configured /chat/completions endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "hello from provider",
            },
          },
        ],
      }),
    });

    const provider = createOpenAiProvider(
      {
        apiStyle: "openai-compatible",
        baseUrl: "http://localhost:11434/v1",
        model: "qwen2.5-coder",
        apiKey: "secret",
        supportsImageInput: false,
      },
      { fetch: fetchMock },
    );

    await provider.plan({ threadId: "t-1", prompt: "say hello" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:11434/v1/chat/completions",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
```

Add an additional runtime-level test that proves the existing runtime can still consume a real provider result without changing `createAgentRuntime()`.

**Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run tests/agent/provider/openai.test.ts tests/agent/runtime.test.ts
```

Expected:
- FAIL because `createOpenAiProvider()` does not yet accept a transport dependency or perform real HTTP work
- existing runtime tests may still pass, but the new provider tests must fail for the right reason

**Step 3: Write minimal implementation**

Make only the smallest base-type adjustments needed by the failing tests. If a transport dependency is introduced, keep it local to `openai.ts` unless the tests prove the type belongs in `base.ts`.

For example, if needed:

```ts
export type OpenAiCompatibleTransport = {
  fetch: typeof fetch;
};
```

Do not redesign `AgentProvider.plan()`.

**Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run tests/agent/provider/openai.test.ts tests/agent/runtime.test.ts
```

Expected:
- PASS for the new provider-contract tests
- PASS for existing runtime tests

**Step 5: Commit**

```bash
git add tests/agent/provider/openai.test.ts tests/agent/runtime.test.ts src/agent/provider/base.ts src/agent/provider/openai.ts
git commit -m "test: define real http provider contract"
```

---

### Task 2: Implement the minimal real OpenAI-compatible HTTP provider

**Files:**
- Modify: `src/agent/provider/openai.ts`
- Test: `tests/agent/provider/openai.test.ts`

**Step 1: Write the failing test**

Extend `tests/agent/provider/openai.test.ts` with the next failing behaviors:

```ts
it("maps plain text content to a reply-only plan", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: "plain reply" } }],
    }),
  });

  const provider = createOpenAiProvider(config, { fetch: fetchMock });

  await expect(provider.plan({ threadId: "t-1", prompt: "hello" })).resolves.toEqual({
    reply: "plain reply",
    actions: [],
  });
});

it("maps strict JSON content to an AgentPlan", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              reply: "Need approval",
              actions: [{ tool: "shell.exec", input: { command: "pwd" } }],
            }),
          },
        },
      ],
    }),
  });

  const provider = createOpenAiProvider(config, { fetch: fetchMock });

  await expect(provider.plan({ threadId: "t-1", prompt: "run pwd" })).resolves.toEqual({
    reply: "Need approval",
    actions: [{ tool: "shell.exec", input: { command: "pwd" } }],
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run tests/agent/provider/openai.test.ts
```

Expected:
- FAIL because `openai.ts` still does not build the request, read the response, or map text/JSON correctly

**Step 3: Write minimal implementation**

Implement the provider in `src/agent/provider/openai.ts` with the smallest useful logic:

```ts
const response = await deps.fetch(`${config.baseUrl}/chat/completions`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    model: config.model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: input.prompt },
    ],
  }),
});
```

Then:
- validate non-2xx responses
- read `choices[0].message.content`
- if content parses as valid `{ reply, actions }`, return it
- otherwise treat the content as plain text and return `{ reply: content, actions: [] }`

Do not add streaming, retries, or broader planner refactors.

**Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run tests/agent/provider/openai.test.ts
```

Expected:
- PASS for endpoint call test
- PASS for auth-header behavior
- PASS for plain-text mapping
- PASS for JSON plan mapping

**Step 5: Commit**

```bash
git add src/agent/provider/openai.ts tests/agent/provider/openai.test.ts
git commit -m "feat: add real http provider"
```

---

### Task 3: Add explicit provider error handling

**Files:**
- Modify: `tests/agent/provider/openai.test.ts`
- Modify: `src/agent/provider/openai.ts`

**Step 1: Write the failing test**

Add failing tests for provider failure boundaries:

```ts
it("throws on non-2xx responses", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: false,
    status: 401,
    text: async () => "unauthorized",
  });

  const provider = createOpenAiProvider(config, { fetch: fetchMock });

  await expect(provider.plan({ threadId: "t-1", prompt: "hello" })).rejects.toThrow(/401/);
});

it("throws on malformed JSON planning payload", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: '{"reply":1}' } }],
    }),
  });

  const provider = createOpenAiProvider(config, { fetch: fetchMock });

  await expect(provider.plan({ threadId: "t-1", prompt: "hello" })).rejects.toThrow(/parse/i);
});
```

Add a fetch-rejection test as well.

**Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run tests/agent/provider/openai.test.ts
```

Expected:
- FAIL because error handling is incomplete or too permissive

**Step 3: Write minimal implementation**

Add explicit provider errors for:
- non-2xx responses
- rejected `fetch`
- empty/missing content
- malformed JSON that looks like a structured plan but does not match the expected shape

Keep the rules simple and visible.

**Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run tests/agent/provider/openai.test.ts
```

Expected:
- PASS for all success and failure cases

**Step 5: Commit**

```bash
git add src/agent/provider/openai.ts tests/agent/provider/openai.test.ts
git commit -m "feat: handle provider http errors"
```

---

### Task 4: Wire the real provider into the smoke entrypoint

**Files:**
- Modify: `tests/app/entrypoint.test.ts`
- Modify: `src/app/entrypoint.ts`
- Maybe check: `src/app/bootstrap.ts`

**Step 1: Write the failing test**

Extend `tests/app/entrypoint.test.ts` so the entrypoint no longer depends on the deterministic fake provider.

```ts
it("builds smoke composition around the real http provider", () => {
  const entry = createDefaultEntrypoint({
    env: {
      ADMIN_USER_ID: "wxid_admin",
      WORKSPACE_ROOT: "/workspace",
      LLM_BASE_URL: "http://localhost:11434/v1",
      LLM_MODEL: "qwen2.5-coder",
      LLM_API_KEY: "",
      LLM_SUPPORTS_IMAGE_INPUT: "false",
      DATABASE_PATH: ":memory:",
    },
  });

  expect(entry.app).toBeDefined();
  expect(entry.gateway).toBeDefined();
  expect(entry.taskService).toBeDefined();
});
```

If needed, add a narrower test that verifies the real provider object carries the configured `config`.

**Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run tests/app/entrypoint.test.ts tests/agent/provider/openai.test.ts
```

Expected:
- FAIL if entrypoint still creates the fake provider or does not wire the real provider correctly

**Step 3: Write minimal implementation**

Update `src/app/entrypoint.ts` to:
- load config via `loadConfig()`
- create the SQLite-backed task service as it does now
- create the real provider from `config.llm`
- inject the real provider into `createAgentRuntime()`
- preserve the current smoke wiring, SQLite-backed task service, and stub tool runners

Do not expand the app-level behavior in this task.

**Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run tests/app/entrypoint.test.ts tests/agent/provider/openai.test.ts
```

Expected:
- PASS for entrypoint composition tests
- PASS for provider tests

**Step 5: Commit**

```bash
git add src/app/entrypoint.ts tests/app/entrypoint.test.ts src/agent/provider/openai.ts
git commit -m "feat: wire real provider into smoke entrypoint"
```

---

### Task 5: Keep the smoke flow and documentation green

**Files:**
- Modify: `README.md`
- Maybe modify: `src/cli.ts` only if the smoke flow needs a minimal adaptation to remain deterministic with a real provider
- Test/Verify: existing app/bootstrap/entrypoint/provider tests

**Step 1: Write the failing test**

If `src/cli.ts` needs adaptation for the real provider, add the smallest failing test coverage in the existing app/bootstrap test files before modifying it.

Otherwise, skip new test creation for the CLI and move directly to verification-driven changes in docs.

Update `README.md` to describe that `start:mvp` now depends on a real OpenAI-compatible provider endpoint instead of a fake provider.

**Step 2: Run test to verify it fails**

Run the smoke command against an intentionally bad endpoint first if needed to observe the real-provider failure mode:

```bash
LLM_BASE_URL=http://127.0.0.1:9 npm run start:mvp
```

Expected:
- FAIL visibly with a provider connection error

This confirms the fake-provider path is gone.

**Step 3: Write minimal implementation**

Update only what is needed so:
- `start:mvp` still exercises the same approval-resume loop
- README explains the real-provider requirement and current limits clearly

Do not add retries or fallback-to-fake behavior.

**Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run tests
npx tsc --noEmit
npm run start:mvp
```

Expected:
- full test suite PASS
- typecheck PASS
- smoke command PASS when pointed at a valid OpenAI-compatible endpoint

If local network access is not available during verification, document the exact blocking condition instead of faking a pass.

**Step 5: Commit**

```bash
git add README.md src/cli.ts tests/app/bootstrap.test.ts tests/app/entrypoint.test.ts
git commit -m "docs: describe real provider smoke flow"
```

---

### Task 6: Final boundary checklist

**Files:**
- No required file edits unless a minimal follow-up fix is necessary

**Step 1: Write the failing test**

No new failing test by default. This task is a verification checklist.

**Step 2: Run test to verify it fails**

Not applicable unless a final gap is found.

**Step 3: Write minimal implementation**

Only if final verification reveals a small issue caused by this slice.

**Step 4: Run test to verify it passes**

Run the final evidence set:

```bash
npx vitest run tests
npx tsc --noEmit
npm run start:mvp
```

Then confirm:
- real provider is used instead of the fake provider
- approval-resume flow still works
- SQLite-backed state still works
- no streaming/retry/multimodal scope creep was added

**Step 5: Commit**

Only create an additional commit if a real final-fix change was needed.
