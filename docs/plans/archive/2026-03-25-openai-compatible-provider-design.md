# OpenAI-Compatible Provider Configuration Design

## Summary

Unify the current LLM provider configuration into a single OpenAI-compatible model that supports a custom base URL, a custom model name, and an optional API key. The repository should stop encoding provider brand names such as `openai` or `ollama` into environment configuration and instead treat any OpenAI-style endpoint as the single supported API surface for the MVP.

## Problem

The current configuration model is provider-name-driven.

- `src/shared/schema.ts` required the old provider-name env variable and `LLM_MODEL`
- `src/shared/config.ts` derived image capability from provider-brand logic instead of explicit configuration
- `src/agent/provider/openai.ts` and `src/agent/provider/ollama.ts` were placeholder wrappers, not real protocol-specific clients

This creates two problems:

1. the configuration shape is tied to brand names instead of transport/API compatibility
2. the capability model is inaccurate because image support is inferred from a provider label rather than explicit runtime capability

The user wants the project to adopt an OpenAI-compatible format with support for a custom model and base URL. That means the configuration should describe connection details and capabilities, not vendor identity.

## Goals

- Replace provider-name-driven LLM configuration with a single OpenAI-compatible configuration model.
- Support custom `baseUrl` and `model` values for local or remote OpenAI-style endpoints.
- Allow an optional API key so both authenticated and local unauthenticated endpoints work.
- Remove capability inference based on provider brand names.
- Keep the agent/provider abstraction intact while simplifying it to one real provider semantic.

## Non-Goals

- Backward compatibility with the old provider-name env format.
- Supporting multiple incompatible provider protocols in the MVP.
- Implementing a full production-ready provider client beyond the needs of the current MVP.
- Adding automatic capability discovery from the remote endpoint.

## Proposed Configuration Model

### Required Variables

- `ADMIN_USER_ID`
- `WORKSPACE_ROOT`
- `DATABASE_PATH`
- `LLM_BASE_URL`
- `LLM_MODEL`

### Optional Variables

- `LLM_API_KEY`
- `LLM_SUPPORTS_IMAGE_INPUT`

### Example

```env
ADMIN_USER_ID=wxid_admin
WORKSPACE_ROOT=/workspace
DATABASE_PATH=./data/wechat-claw.db

LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=qwen2.5-coder
LLM_API_KEY=
LLM_SUPPORTS_IMAGE_INPUT=false
```

## Runtime Configuration Shape

`loadConfig()` should return a normalized LLM config with one API style:

```ts
llm: {
  apiStyle: "openai-compatible",
  baseUrl: string,
  model: string,
  apiKey?: string,
  supportsImageInput: boolean,
}
```

This replaces the prior legacy shape:

```ts
provider: {
  type: legacyProviderName,
  model: legacyModelName,
  capabilities: {
    imageInput: inferredFromProviderLabel,
  },
}
```

## Architecture Changes

### `src/shared/schema.ts`

Update the environment schema to:

- remove the old provider-name env variable
- add required `LLM_BASE_URL`
- keep required `LLM_MODEL`
- add optional `LLM_API_KEY`
- add optional `LLM_SUPPORTS_IMAGE_INPUT`

If `LLM_SUPPORTS_IMAGE_INPUT` is implemented as an environment string, it should be parsed into a boolean in a predictable way rather than passed through as raw text.

### `src/shared/config.ts`

Update `loadConfig()` so it:

- stops producing `provider.type`
- produces `llm.apiStyle = "openai-compatible"`
- passes through `baseUrl`, `model`, and optional `apiKey`
- derives `supportsImageInput` from explicit config, defaulting to `false`

### Provider Layer

The provider abstraction in `src/agent/provider/base.ts` can remain in place. The important change is semantic, not structural:

- the application keeps an `AgentProvider` interface
- the only real provider meaning in the MVP becomes OpenAI-compatible HTTP behavior
- provider identity is no longer a user-facing configuration concept

### `src/agent/provider/openai.ts`

This file should either:

1. remain in place but become the generic OpenAI-compatible provider implementation, or
2. be renamed to `openai-compatible.ts`

Recommendation: keep the file path if minimizing churn matters, but update the implementation and naming inside the file to reflect generic OpenAI-compatible semantics.

### `src/agent/provider/ollama.ts`

This file should no longer be treated as a distinct provider entrypoint for configuration or runtime routing. It may be removed or left unused temporarily, but it should not remain part of the active MVP configuration model.

## Capability Handling

Capability handling must become explicit.

Current legacy behavior:

- image capability was inferred from provider-brand semantics instead of explicit capability configuration

Proposed behavior:

- `imageInput` is controlled by `LLM_SUPPORTS_IMAGE_INPUT`
- if unset, default to `false`

This is intentionally conservative. Some OpenAI-compatible endpoints support vision, some do not, and provider brand names are not a reliable proxy.

## Error Handling

- Missing `LLM_BASE_URL` or `LLM_MODEL` should fail configuration loading immediately.
- Missing `LLM_API_KEY` should not fail startup by default, because some local OpenAI-compatible endpoints do not require authentication.
- If a vision path is requested while `imageInput === false`, runtime behavior should fail clearly and record the error rather than silently downgrade.
- If the configured endpoint is unreachable or does not behave like an OpenAI-compatible API, the provider failure should be surfaced as a task/runtime error.

## Migration Strategy

This migration is a deliberate convergence, not a compatibility bridge.

That means:

- the repository stops recommending the old provider-name env format
- the README and `.env.example` should be updated to the new variables
- tests that assert provider-name-based capability behavior should be rewritten around explicit config values

The MVP should prefer one clean model over carrying two configuration systems at once.

## Testing Strategy

At minimum, the migration should cover:

1. configuration schema tests
   - required `LLM_BASE_URL`
   - required `LLM_MODEL`
   - optional `LLM_API_KEY`
   - default `LLM_SUPPORTS_IMAGE_INPUT=false`
2. config loader tests
   - normalized `llm.apiStyle`
   - correct `baseUrl`, `model`, and `apiKey` mapping
   - explicit image capability behavior
3. documentation updates
   - `README.md`
   - `.env.example`
4. provider wiring checks
   - no remaining runtime dependence on the old provider-name env variable
   - no remaining capability inference from provider brand names

## Recommended Execution Order

1. update schema and config tests first
2. update config loader implementation
3. update provider semantics/wiring
4. update README and `.env.example`
5. run typecheck and focused tests

## Decision

The project will standardize on a single OpenAI-compatible provider configuration model with customizable base URL and model, an optional API key, and explicit capability flags. The old provider-name-based configuration is intentionally retired rather than preserved.
