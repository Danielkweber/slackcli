# slackcli Development Notes

## Overview

TypeScript CLI for Slack, built with Bun + Commander.js. Strict typing — zero `any` in source.
- **Repo**: [Danielkweber/slackcli](https://github.com/Danielkweber/slackcli) (standalone, originally forked from shaharia-lab/slackcli)
- **Branch convention**: `daniel/feat/<name>`, `daniel/fix/<name>`

## Dev Workflow

```bash
# Run locally (dev script already includes src/index.ts — don't pass it again)
bun run dev conversations list
bun run dev conversations list-unreads

# Type check
bun run type-check

# Tests
bun test

# Build binary
bun run build
```

## Architecture

- `src/index.ts` — CLI entry point (Commander)
- `src/commands/` — subcommand definitions (conversations, messages, auth, files, search)
- `src/lib/slack-client.ts` — Slack API client (supports both standard token and browser auth)
- `src/lib/formatter.ts` — human-readable output formatting
- `src/lib/auth.ts` — workspace config and client factory
- `src/types/index.ts` — shared TypeScript interfaces

## Auth Types

Two auth modes, handled transparently by `SlackClient`:
- **Standard** (`xoxb-`/`xoxp-` tokens): uses `@slack/web-api` WebClient
- **Browser** (`xoxc-`/`xoxd-` tokens): custom fetch with cookie-based auth. Accesses internal Slack APIs not available to standard tokens.

## Slack API Gotchas

- `conversations.list` does NOT return `unread_count` fields. Use `client.counts` (internal API, browser auth only) for unread detection.
- `conversations.list` with `cursor: undefined` serializes as the string `"undefined"` via URLSearchParams in browser auth — always omit the key when cursor is falsy.
- `client.counts` returns `{ channels, mpims, ims }` arrays with `{ id, has_unreads, mention_count, last_read, latest }` per entry. No channel names — need `conversations.info` to resolve.
- Workspace name in config is case-sensitive ("Suno" not "suno").

## Typing Conventions

All Slack API responses are typed via interfaces in `src/types/index.ts`:
- `SlackApiResponse` — base interface (`ok: boolean`, `error?: string`). All response types extend it.
- Endpoint-specific types: `SlackConversationsListResponse`, `SlackConversationHistoryResponse`, `SlackPostMessageResponse`, etc.
- `SlackClient` methods return specific types (e.g., `Promise<SlackPostMessageResponse>`), not `Promise<any>`.

**How it works internally:** The generic `request()` method returns `Promise<SlackApiResponse>`. Each public method casts via `as Promise<SpecificType>`. This is the standard pattern for a single-entry-point API client — the cast is safe because we control which API method maps to which response type.

**`Record<string, any>` on `request()`/`standardRequest()`/`browserRequest()`:** Intentionally kept as `any` (with eslint-disable comments) because `@slack/web-api`'s `apiCall` accepts `any` and browser auth's `URLSearchParams` needs flexible values. Public methods use narrower param types (`Record<string, string>` etc.).

**Error handling:** All `catch` blocks use `unknown` (not `any`). Pattern:
```typescript
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  error(message);
}
```

**`any` policy:** Zero `any` in source files. Only allowed in test mocks (for `(client as any).request = mock(...)` pattern) and the three internal request methods (documented above).

## Testing

Tests use `bun:test` with a mock pattern:
```typescript
function createMockClient() {
  const client = new SlackClient(browserConfig);
  const requestMock = mock(() => Promise.resolve({}));
  (client as any).request = requestMock;
  return { client, requestMock };
}
```

## Release Process

Tag-based: push a `v*.*.*` tag to trigger the `Release` workflow (`.github/workflows/release.yml`).
- Builds cross-platform binaries (Linux x64, macOS x64, macOS ARM64, Windows x64) via GitHub Actions matrix
- Creates a GitHub Release with binaries + SHA256 checksums
- No Homebrew distribution — removed in v0.3.0
- Version is single-sourced from `package.json` — both `--version` output and the self-updater read from it. Just bump `package.json` before tagging.

**CI workflows:** `ci.yml` (typecheck + build + smoke test) and `test.yml` (unit + integration tests) run on push/PR to main.

**Third-party actions:** `softprops/action-gh-release@v1` is pinned to major version tag (not SHA). `oven-sh/setup-bun@v1` uses `bun-version: latest` (not pinned). Both are low-risk for a personal project but worth noting.

## Features Added via Fork

| Feature | PR | API Used |
|---|---|---|
| File uploads | #13 (superseded by #14) | `files.getUploadURLExternal` → upload → `files.completeUploadExternal` |
| Search | #14 | `search.all` |
| List unreads | #15 | `client.counts` (internal) + `conversations.info` |
| Mark read | #15 | `conversations.mark` |
| List unread threads | — | `subscriptions.thread.getView` (internal) + `conversations.info` |
