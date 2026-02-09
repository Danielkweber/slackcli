# SlackCLI

A fast, developer-friendly command-line interface for interacting with Slack workspaces. Built with TypeScript and Bun, it enables AI agents, automation tools, and developers to access Slack functionality directly from the terminal.

## Features

- **Dual Authentication** - Standard Slack tokens (xoxb/xoxp) or browser session tokens (xoxd/xoxc)
- **Easy Token Extraction** - Parse tokens automatically from browser cURL commands
- **Multi-Workspace** - Manage and switch between multiple Slack workspaces
- **Conversations** - List channels, read messages, track unreads, mark as read
- **Unread Threads** - View subscribed threads with unread replies
- **Search** - Full-text search across messages and files with Slack query syntax
- **File Uploads** - Upload one or more files to channels or threads
- **Message Reactions** - Add emoji reactions to messages programmatically
- **Auto-Update** - Built-in self-update mechanism

## Installation

### Pre-built Binaries

#### Linux
```bash
curl -L https://github.com/Danielkweber/slackcli/releases/latest/download/slackcli-linux -o slackcli
chmod +x slackcli
mkdir -p ~/.local/bin && mv slackcli ~/.local/bin/
```

#### macOS (Intel)
```bash
curl -L https://github.com/Danielkweber/slackcli/releases/latest/download/slackcli-macos -o slackcli
chmod +x slackcli
mkdir -p ~/.local/bin && mv slackcli ~/.local/bin/
```

#### macOS (Apple Silicon)
```bash
curl -L https://github.com/Danielkweber/slackcli/releases/latest/download/slackcli-macos-arm64 -o slackcli
chmod +x slackcli
mkdir -p ~/.local/bin && mv slackcli ~/.local/bin/
```

#### Windows
Download `slackcli-windows.exe` from the [latest release](https://github.com/Danielkweber/slackcli/releases/latest) and add it to your PATH.

### From Source

```bash
git clone https://github.com/Danielkweber/slackcli.git
cd slackcli
bun install
bun run build
```

## Authentication

SlackCLI supports two authentication methods:

### 1. Standard Slack App Tokens (Recommended for Production)

Create a Slack app at [api.slack.com/apps](https://api.slack.com/apps) and obtain a bot token (xoxb-*) or user token (xoxp-*).

```bash
slackcli auth login --token=xoxb-YOUR-TOKEN --workspace-name="My Team"
```

### 2. Browser Session Tokens (Quick Setup)

Extract tokens from your browser session. No Slack app creation required!

```bash
# Step 1: Get extraction guide
slackcli auth extract-tokens

# Step 2: Login with extracted tokens
slackcli auth login-browser \
  --xoxd=xoxd-YOUR-TOKEN \
  --xoxc=xoxc-YOUR-TOKEN \
  --workspace-url=https://yourteam.slack.com
```

**How to Extract Browser Tokens:**

1. Open your Slack workspace in a web browser
2. Open Developer Tools (F12)
3. Go to Network tab
4. Send a message or refresh
5. Find a Slack API request
6. Extract:
   - `xoxd` token from Cookie header (d=xoxd-...)
   - `xoxc` token from request payload ("token":"xoxc-...")

### 3. Easy Method: Parse cURL Command (Recommended for Browser Tokens)

The easiest way to extract browser tokens is to copy a Slack API request as cURL and let SlackCLI parse it automatically!

```bash
# Step 1: In browser DevTools, right-click any Slack API request
#         -> Copy -> Copy as cURL

# Step 2: Interactive mode (recommended) - just paste and press Enter twice
slackcli auth parse-curl --login

# Alternative: Read directly from clipboard
slackcli auth parse-curl --from-clipboard --login

# Alternative: Pipe from clipboard or file
pbpaste | slackcli auth parse-curl --login
cat curl-command.txt | slackcli auth parse-curl --login
```

This automatically extracts:
- Workspace URL and name
- xoxd token from cookies
- xoxc token from request data

## Usage

### Authentication Commands

```bash
# List all authenticated workspaces
slackcli auth list

# Set default workspace
slackcli auth set-default T1234567

# Remove a workspace
slackcli auth remove T1234567

# Logout from all workspaces
slackcli auth logout
```

### Conversation Commands

```bash
# List all conversations
slackcli conversations list

# List only public channels
slackcli conversations list --types=public_channel

# List DMs
slackcli conversations list --types=im

# Read recent messages from a channel
slackcli conversations read C1234567890

# Read a specific thread
slackcli conversations read C1234567890 --thread-ts=1234567890.123456

# Read with custom limit
slackcli conversations read C1234567890 --limit=50

# Get JSON output (includes ts and thread_ts for replies)
slackcli conversations read C1234567890 --json

# List conversations with unread messages
slackcli conversations list-unreads

# List conversations with unreads (JSON output)
slackcli conversations list-unreads --json

# List threads with unread replies
slackcli conversations list-unread-threads

# Show all subscribed threads (not just unread)
slackcli conversations list-unread-threads --all

# Mark a conversation as read
slackcli conversations mark-read C1234567890

# Mark read up to a specific message
slackcli conversations mark-read C1234567890 --timestamp=1234567890.123456
```

### Message Commands

```bash
# Send message to a channel
slackcli messages send --recipient-id=C1234567890 --message="Hello team!"

# Send DM to a user
slackcli messages send --recipient-id=U9876543210 --message="Hey there!"

# Reply to a thread
slackcli messages send --recipient-id=C1234567890 --thread-ts=1234567890.123456 --message="Great idea!"

# Add emoji reaction to a message
slackcli messages react --channel-id=C1234567890 --timestamp=1234567890.123456 --emoji=+1
slackcli messages react --channel-id=C1234567890 --timestamp=1234567890.123456 --emoji=heart
```

### Search Commands

```bash
# Search messages and files
slackcli search "quarterly report"

# Search with Slack query syntax
slackcli search "from:@alice in:#general budget"

# Sort by timestamp instead of relevance
slackcli search "deploy" --sort=timestamp

# Paginate results
slackcli search "bug" --count=50 --page=2

# JSON output
slackcli search "meeting notes" --json
```

### File Commands

```bash
# Upload a file to a channel
slackcli files upload --file=./report.pdf --channel-id=C1234567890

# Upload with a title and message
slackcli files upload --file=./chart.png --channel-id=C1234567890 --title="Q4 Chart" --message="Here's the latest"

# Upload multiple files
slackcli files upload --file=./doc1.pdf --file=./doc2.pdf --channel-id=C1234567890

# Upload as a thread reply
slackcli files upload --file=./patch.diff --channel-id=C1234567890 --thread-ts=1234567890.123456
```

### Update Commands

```bash
# Check for updates
slackcli update check

# Update to latest version
slackcli update
```

### Multi-Workspace Usage

```bash
# Use specific workspace by ID
slackcli conversations list --workspace=T1234567

# Use specific workspace by name
slackcli conversations list --workspace="My Team"
```

## Configuration

Configuration is stored in `~/.config/slackcli/`:

- `workspaces.json` - Workspace credentials
- `config.json` - User preferences (future)

## Development

### Prerequisites

- Bun v1.0+
- TypeScript 5.x+

### Setup

```bash
# Install dependencies
bun install

# Run in development mode
bun run dev --help

# Build binary
bun run build

# Build for all platforms
bun run build:all

# Run tests
bun test

# Type check
bun run type-check
```

### Project Structure

```
slackcli/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── commands/             # Command implementations
│   │   ├── auth.ts
│   │   ├── conversations.ts
│   │   ├── files.ts
│   │   ├── messages.ts
│   │   ├── search.ts
│   │   └── update.ts
│   ├── lib/                  # Core library
│   │   ├── auth.ts
│   │   ├── clipboard.ts
│   │   ├── curl-parser.ts
│   │   ├── formatter.ts
│   │   ├── interactive-input.ts
│   │   ├── slack-client.ts
│   │   ├── updater.ts
│   │   └── workspaces.ts
│   └── types/                # Type definitions
│       └── index.ts
├── .github/workflows/        # CI/CD
└── dist/                     # Build output
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Tips & Gotchas

### Browser Auth vs Standard Auth

Some features use internal Slack APIs that are only available with browser tokens (xoxd/xoxc), not standard bot/user tokens (xoxb/xoxp):

| Feature | Standard tokens | Browser tokens |
|---------|:-:|:-:|
| List/read/send messages | Yes | Yes |
| Search | Yes | Yes |
| File uploads | Yes | Yes |
| Reactions | Yes | Yes |
| List unreads (`list-unreads`) | No | Yes |
| List unread threads (`list-unread-threads`) | No | Yes |
| Mark as read (`mark-read`) | No | Yes |

### Browser Token Tips

- **URL-decode xoxd tokens before use.** Browser cookies often URL-encode special characters (`%2B` for `+`, `%2F` for `/`). Pass the decoded value to `auth login-browser` or you'll get `invalid_auth`.
- **Tokens expire periodically** (days to weeks). Re-authenticate with fresh tokens when you start getting auth errors.
- The parse-curl method (`auth parse-curl --login`) handles decoding automatically and is the easiest approach.

### Working with Timestamps

- Use `--json` on `conversations read` to get message timestamps — these are required for thread replies (`--thread-ts`) and reactions (`--timestamp`). The human-readable output shows formatted dates but not raw timestamps.
- Thread reads include the parent message as the first entry in the output.

### Large Workspaces

- `conversations list` returns up to `--limit` conversations (default: 100), sorted by most recent activity. In large workspaces, increase `--limit` or use `--types` to filter.
- `conversations.list` does **not** return unread counts. Use `conversations list-unreads` instead.

## Troubleshooting

### Authentication Issues

**Standard Tokens:**
- Ensure your token has the required OAuth scopes
- Check token validity in your Slack app settings

**Browser Tokens:**
- Tokens expire with your browser session — extract fresh tokens if authentication fails
- URL-decode xoxd tokens before passing them (see Tips above)
- Verify workspace URL format (https://yourteam.slack.com)

### Permission Errors

If you get permission errors when accessing conversations or sending messages:
- Verify your bot/user has been added to the channel
- Check OAuth scopes include required permissions
- For browser tokens, ensure you have access in the web UI

### Update Issues

If `slackcli update` fails:
- Ensure you have write permissions to the binary location
- Try running with sudo if installed system-wide
- Consider installing to user directory (~/.local/bin) instead

## License

MIT License - see [LICENSE](LICENSE) file for details

## Support

- [Report Issues](https://github.com/Danielkweber/slackcli/issues)

## Acknowledgments

- Built with [Bun](https://bun.sh)
- Powered by [@slack/web-api](https://slack.dev/node-slack-sdk/)
- Originally based on [shaharia-lab/slackcli](https://github.com/shaharia-lab/slackcli)
