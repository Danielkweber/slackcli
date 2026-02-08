# slackcli Development Notes

## Overview

TypeScript CLI for Slack, built with Bun + Commander.js.
- **Upstream**: [shaharia-lab/slackcli](https://github.com/shaharia-lab/slackcli)
- **Fork**: [Danielkweber/slackcli](https://github.com/Danielkweber/slackcli)
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

## Features Added via Fork

| Feature | PR | API Used |
|---|---|---|
| File uploads | #13 (superseded by #14) | `files.getUploadURLExternal` → upload → `files.completeUploadExternal` |
| Search | #14 | `search.all` |
| List unreads | #15 | `client.counts` (internal) + `conversations.info` |
| Mark read | #15 | `conversations.mark` |
