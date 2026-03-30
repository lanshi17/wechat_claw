# Real HTTP Provider Smoke Slice Design

## Summary

Replace the current fake OpenAI-compatible provider with a minimal real HTTP-backed provider while keeping the existing smoke flow intact. The goal of this slice is to preserve the current runnable CLI flow (`start:mvp`), approval/resume behavior, and SQLite-backed task state, but make planning come from an actual OpenAI-compatible `/chat/completions` endpoint instead of a deterministic in-process fake.

## Why This Slice

The repository now has a meaningful local smoke path:

1. message enters the app
2. runtime produces a plan
3. approval request is created when needed
4. action resumes and completes
5. thread, events, and approval state persist in SQLite

But the current provider layer is still fake:

- `src/agent/provider/openai.ts` only wraps a provider object and stores config
- `src/app/entrypoint.ts` still constructs a deterministic fake provider
- `start:mvp` proves orchestration, not real provider integration

That means the largest remaining fake layer in the MVP path is the provider itself. Replacing it with a real OpenAI-compatible HTTP adapter is therefore the next highest-value slice.

## Product Goal for This Slice

A local developer should be able to configure:

- `LLM_BASE_URL`
- `LLM_MODEL`
- optional `LLM_API_KEY`

then run `start:mvp` and know that:

1. planning comes from a real OpenAI-compatible HTTP endpoint
2. the existing smoke flow still works end-to-end
3. provider failures are explicit and visible
4. the current approval + SQLite + CLI flow remains intact

## Scope

### In Scope

- implement a minimal real HTTP provider in `src/agent/provider/openai.ts`
- call `${LLM_BASE_URL}/chat/completions`
- use the existing `AgentProvider.plan()` contract unchanged
- support two response modes:
  - plain text -> `{ reply, actions: [] }`
  - strict JSON -> parsed `AgentPlan`
- wire `src/app/entrypoint.ts` to use the real provider instead of the fake provider
- add focused provider tests with mocked `fetch`
- preserve the current smoke flow, approval behavior, and SQLite-backed task flow

### Out of Scope

- streaming responses
- retries and backoff
- multimodal image execution
- standard tool-calling protocol integration
- provider metrics or tracing
- additional provider brands or multi-provider routing
- planner-framework redesign

## Recommended Approach

### Chosen Approach

Implement the smallest real OpenAI-compatible provider adapter while keeping the current app/runtime shape unchanged.

That means:

- keep `AgentProvider.plan(input)` unchanged
- keep `createAgentRuntime()` unchanged or nearly unchanged
- keep `src/app/main.ts` orchestration unchanged
- replace the fake provider in `src/app/entrypoint.ts` with a real one created from config

This slice should not redesign the runtime. It should only replace the provider internals.

### Alternatives Considered

#### 1. Provider client layer first

Rejected for now. A separate client/transport abstraction could be useful later, but it would expand this slice beyond the smallest useful real integration.

#### 2. Full provider upgrade with streaming and retries

Rejected for now. That would widen the verification surface too much and distract from the core goal of replacing the fake provider.

#### 3. Keep fake provider and add an optional real-provider mode

Rejected for now. It would reduce confidence in the main path and leave the repo in an ambiguous mixed state. The highest-value path is to make the default smoke provider real.

## Provider Contract

Keep the current contract exactly:

```ts
AgentProvider.plan(input: { threadId: string; prompt: string }): Promise<AgentPlan>
```

This is deliberate. The runtime and app already depend on this shape, and there is no need to expand it in this slice.

## Request Path

The real provider should issue a POST request to:

```txt
${LLM_BASE_URL}/chat/completions
```

### Required headers

- `Content-Type: application/json`
- `Authorization: Bearer ${LLM_API_KEY}` only when `LLM_API_KEY` is non-empty

### Minimal request body

```json
{
  "model": "<LLM_MODEL>",
  "messages": [
    { "role": "system", "content": "<minimal planner instruction>" },
    { "role": "user", "content": "<prompt>" }
  ]
}
```

The system instruction should be small and fixed. It should require the model to either:

1. return plain text for a direct reply, or
2. return strict JSON of the form:
   ```json
   {
     "reply": "...",
     "actions": [
       { "tool": "shell.exec", "input": { "command": "pwd" } }
     ]
   }
   ```

Only currently-supported tool names need to be mentioned in this prompt.

## Response Mapping

### Plain text response

If the completion is plain text and not valid planning JSON, map it to:

```ts
{ reply: text, actions: [] }
```

### Strict JSON response

If the completion body contains valid JSON matching the `AgentPlan` shape, map it directly to the in-project plan contract.

### Invalid response

If the content cannot be parsed into either:

- plain text reply, or
- valid strict JSON plan

then the provider should throw an explicit parse error.

No silent fallback to “success” is allowed.

## Architecture Changes

### `src/agent/provider/openai.ts`

This file should become the minimal real provider implementation.

Responsibilities:

- accept `OpenAiCompatibleProviderConfig`
- call the configured `/chat/completions` endpoint
- build the minimal request body
- interpret the response
- map to `AgentPlan`
- throw explicit provider errors on failure

It should not take on broader runtime responsibilities.

### `src/agent/provider/base.ts`

Only minimal type changes should happen here, if any. The current config shape is already good enough for this slice.

### `src/app/entrypoint.ts`

Replace the fake provider construction with a real provider created from `config.llm`.

Keep these existing behaviors:

- SQLite-backed task service
- fake/stub tool runners where still needed
- approval-resume smoke orchestration
- `setCurrentMessage(...)` helper for CLI smoke flow

### `src/agent/runtime.ts`

No architectural change intended. It should continue to call `planNextAction(deps.provider, input)`.

## Error Handling

Provider errors must be explicit and visible.

### Must handle

- non-2xx HTTP responses
- network/connection failure
- timeout
- missing response choices
- empty message content
- malformed JSON when JSON is expected
- JSON that does not match `{ reply, actions }`

### Error behavior

The provider should throw a descriptive error that lets the app/CLI fail visibly. This slice does not require sophisticated retry logic or recovery.

## Testing Strategy

### Provider unit tests

Add focused tests around the provider using mocked `fetch`.

Minimum cases:

1. sends request to `/chat/completions` with the configured base URL
2. includes `Authorization` header only when API key is provided
3. maps plain text response to `{ reply, actions: [] }`
4. maps strict JSON response to `AgentPlan`
5. throws on non-2xx response
6. throws on malformed/empty response
7. throws on timeout or rejected fetch

### Smoke verification

Keep `start:mvp` as the end-to-end verification path.

The smoke flow should still demonstrate:

1. planning request
2. approval creation when action is approval-required
3. approval resume
4. final thread completion

The difference is that planning should now come from a real HTTP provider.

## Verification Commands

Preferred verification commands for this slice:

```bash
pnpm test
pnpm typecheck
pnpm start:mvp
```

Acceptable local fallback if `pnpm` is unavailable:

```bash
npx vitest run tests
npx tsc --noEmit
npm run start:mvp
```

## Success Criteria

This slice is complete when:

1. `src/agent/provider/openai.ts` performs a real OpenAI-compatible HTTP request
2. `src/app/entrypoint.ts` uses the real provider instead of the fake provider
3. provider unit tests cover request shape and failure cases
4. `start:mvp` still works end-to-end
5. approval-resume and SQLite persistence behavior are preserved
6. no streaming/retry/multimodal scope creep is introduced

## Follow-Up After This Slice

Once the real provider is in place, the next likely slices become:

- provider-level retries / timeout policy
- richer planner prompting and response normalization
- streaming support
- TUI approval queue and thread projection
- restart recovery from SQLite-backed pending state
