// Type definitions for SlackCLI

export type AuthType = 'standard' | 'browser';
export type TokenType = 'bot' | 'user';
export type ConversationType = 'public_channel' | 'private_channel' | 'mpim' | 'im';

// Workspace configuration interfaces
export interface StandardAuthConfig {
  workspace_id: string;
  workspace_name: string;
  auth_type: 'standard';
  token: string;
  token_type: TokenType;
}

export interface BrowserAuthConfig {
  workspace_id: string;
  workspace_name: string;
  workspace_url: string;
  auth_type: 'browser';
  xoxd_token: string;
  xoxc_token: string;
}

export type WorkspaceConfig = StandardAuthConfig | BrowserAuthConfig;

export interface WorkspacesData {
  default_workspace?: string;
  workspaces: Record<string, WorkspaceConfig>;
}

// Slack API response types
export interface SlackChannel {
  id: string;
  name?: string;
  is_channel?: boolean;
  is_group?: boolean;
  is_im?: boolean;
  is_mpim?: boolean;
  is_private?: boolean;
  is_archived?: boolean;
  is_member?: boolean;
  num_members?: number;
  topic?: {
    value: string;
  };
  purpose?: {
    value: string;
  };
  user?: string; // For DMs
  unread_count?: number;
  unread_count_display?: number;
}

export interface SlackUser {
  id: string;
  name?: string;
  real_name?: string;
  profile?: {
    email?: string;
    display_name?: string;
    real_name?: string;
  };
}

export interface SlackMessage {
  type: string;
  user?: string;
  bot_id?: string;
  text: string;
  ts: string;
  thread_ts?: string;
  reply_count?: number;
  reactions?: Array<{
    name: string;
    count: number;
    users: string[];
  }>;
}

export interface SlackAuthTestResponse extends SlackApiResponse {
  url: string;
  team: string;
  user: string;
  team_id: string;
  user_id: string;
  bot_id?: string;
  is_enterprise_install?: boolean;
}

// CLI options interfaces
export interface ConversationListOptions {
  types?: string;
  limit?: number;
  excludeArchived?: boolean;
  workspace?: string;
}

export interface ConversationReadOptions {
  threadTs?: string;
  excludeReplies?: boolean;
  limit?: number;
  oldest?: string;
  latest?: string;
  workspace?: string;
}

export interface MessageSendOptions {
  recipientId: string;
  message: string;
  threadTs?: string;
  workspace?: string;
}

export interface AuthLoginOptions {
  token: string;
  workspaceName: string;
}

export interface AuthLoginBrowserOptions {
  xoxd: string;
  xoxc: string;
  workspaceUrl: string;
  workspaceName?: string;
}

// Search types
export interface SlackSearchPaging {
  count: number;
  total: number;
  page: number;
  pages: number;
}

export interface SlackSearchMessageMatch {
  type: string;
  user: string;
  username: string;
  ts: string;
  text: string;
  channel: { id: string; name: string };
  permalink: string;
}

export interface SlackSearchFileMatch {
  id: string;
  name: string;
  title: string;
  filetype: string;
  user: string;
  timestamp: number;
  channels: string[];
  permalink: string;
}

export interface SlackSearchResponse extends SlackApiResponse {
  query: string;
  messages: { matches: SlackSearchMessageMatch[]; paging: SlackSearchPaging };
  files: { matches: SlackSearchFileMatch[]; paging: SlackSearchPaging };
}

// Thread view types (subscriptions.thread.getView internal API)
export interface SlackThreadEntry {
  root_msg: {
    text: string;
    user: string;
    ts: string;
    thread_ts: string;
    channel: string;
    reply_count?: number;
    reply_users?: string[];
    latest_reply?: string;
    last_read?: string;
    subscribed?: boolean;
    reactions?: Array<{ name: string; count: number; users: string[] }>;
  };
  unread_replies?: SlackMessage[];
  latest_replies?: SlackMessage[];
}

export interface SlackThreadView extends SlackApiResponse {
  total_unread_replies: number;
  new_threads_count: number;
  has_more: boolean;
  max_ts: string;
  threads: SlackThreadEntry[];
}

// Base API response — all Slack API responses have `ok`
export interface SlackApiResponse {
  ok: boolean;
  error?: string;
}

// conversations.list
export interface SlackConversationsListResponse extends SlackApiResponse {
  channels: SlackChannel[];
  response_metadata?: { next_cursor?: string };
}

// conversations.info
export interface SlackConversationInfoResponse extends SlackApiResponse {
  channel: SlackChannel;
}

// conversations.history / conversations.replies
export interface SlackConversationHistoryResponse extends SlackApiResponse {
  messages: SlackMessage[];
  has_more?: boolean;
  response_metadata?: { next_cursor?: string };
}

// conversations.mark
export interface SlackConversationMarkResponse extends SlackApiResponse {}

// conversations.open
export interface SlackConversationOpenResponse extends SlackApiResponse {
  channel: { id: string };
}

// chat.postMessage
export interface SlackPostMessageResponse extends SlackApiResponse {
  channel: string;
  ts: string;
  message: SlackMessage;
}

// users.info
export interface SlackUserInfoResponse extends SlackApiResponse {
  user: SlackUser;
}

// users batch (our own aggregate shape)
export interface SlackUsersInfoResponse extends SlackApiResponse {
  users: SlackUser[];
}

// reactions.add / reactions.remove
export interface SlackReactionResponse extends SlackApiResponse {}

// client.counts (internal Slack API)
export interface SlackClientCountsResponse extends SlackApiResponse {
  channels: Array<{ id: string; mention_count: number; has_unreads: boolean }>;
  mpims: Array<{ id: string; mention_count: number; has_unreads: boolean }>;
  ims: Array<{ id: string; mention_count: number; has_unreads: boolean }>;
}

// File upload types
export interface FileUploadUrlResponse extends SlackApiResponse {
  upload_url: string;
  file_id: string;
}

export interface FileUploadCompleteResponse extends SlackApiResponse {
  files: Array<{ id: string; title?: string }>;
}

