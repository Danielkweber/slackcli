import { WebClient } from '@slack/web-api';
import type {
  WorkspaceConfig,
  SlackApiResponse,
  SlackAuthTestResponse,
  SlackConversationsListResponse,
  SlackConversationInfoResponse,
  SlackConversationHistoryResponse,
  SlackConversationMarkResponse,
  SlackConversationOpenResponse,
  SlackPostMessageResponse,
  SlackUserInfoResponse,
  SlackUsersInfoResponse,
  SlackReactionResponse,
  SlackClientCountsResponse,
  SlackThreadView,
  SlackSearchResponse,
  SlackUser,
  FileUploadUrlResponse,
  FileUploadCompleteResponse,
} from '../types/index.ts';

export class SlackClient {
  private config: WorkspaceConfig;
  private webClient?: WebClient;

  constructor(config: WorkspaceConfig) {
    this.config = config;

    // Only use WebClient for standard auth
    if (config.auth_type === 'standard') {
      this.webClient = new WebClient(config.token);
    }
  }

  // Make API request (handles both auth types)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- params vary per method, callers cast return type
  async request(method: string, params: Record<string, any> = {}): Promise<SlackApiResponse> {
    if (this.config.auth_type === 'standard') {
      return this.standardRequest(method, params);
    } else {
      return this.browserRequest(method, params);
    }
  }

  // Standard token request (using @slack/web-api)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- @slack/web-api apiCall accepts any
  private async standardRequest(method: string, params: Record<string, any>): Promise<SlackApiResponse> {
    if (!this.webClient) {
      throw new Error('WebClient not initialized');
    }

    try {
      const response = await this.webClient.apiCall(method, params);
      return response as unknown as SlackApiResponse;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Slack API error: ${message}`);
    }
  }

  // Browser token request (custom implementation)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- params vary per method
  private async browserRequest(method: string, params: Record<string, any>): Promise<SlackApiResponse> {
    if (this.config.auth_type !== 'browser') {
      throw new Error('Invalid auth type');
    }

    const url = `${this.config.workspace_url}/api/${method}`;

    const formBody = new URLSearchParams({
      token: this.config.xoxc_token,
      ...params,
    });

    try {
      // URL-encode the xoxd token for the cookie
      const encodedXoxdToken = encodeURIComponent(this.config.xoxd_token);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Cookie': `d=${encodedXoxdToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Origin': 'https://app.slack.com',
          'User-Agent': 'Mozilla/5.0 (compatible; SlackCLI/0.1.0)',
        },
        body: formBody,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json() as SlackApiResponse;

      if (!data.ok) {
        throw new Error(data.error || 'Unknown API error');
      }

      return data;
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('Slack API error:')) {
        throw err;
      }
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Slack API error: ${message}`);
    }
  }

  // Test authentication
  async testAuth(): Promise<SlackAuthTestResponse> {
    return this.request('auth.test', {}) as Promise<SlackAuthTestResponse>;
  }

  // List conversations
  async listConversations(options: {
    types?: string;
    limit?: number;
    exclude_archived?: boolean;
    cursor?: string;
  } = {}): Promise<SlackConversationsListResponse> {
    return this.request('conversations.list', options) as Promise<SlackConversationsListResponse>;
  }

  // Mark conversation as read
  async markConversationRead(channel: string, ts: string): Promise<SlackConversationMarkResponse> {
    return this.request('conversations.mark', { channel, ts }) as Promise<SlackConversationMarkResponse>;
  }

  // Get unread counts (uses internal Slack API, works with browser auth)
  async getClientCounts(): Promise<SlackClientCountsResponse> {
    return this.request('client.counts', {}) as Promise<SlackClientCountsResponse>;
  }

  // Get subscribed threads view (uses internal Slack API, works with browser auth)
  async getThreadsView(options: { limit?: number; max_ts?: string } = {}): Promise<SlackThreadView> {
    const params: Record<string, string> = {
      current_ts: String(Date.now() / 1000),
    };
    if (options.limit) params.limit = String(options.limit);
    if (options.max_ts) params.max_ts = options.max_ts;
    return this.request('subscriptions.thread.getView', params) as Promise<SlackThreadView>;
  }

  // Get conversation info
  async getConversationInfo(channel: string): Promise<SlackConversationInfoResponse> {
    return this.request('conversations.info', { channel }) as Promise<SlackConversationInfoResponse>;
  }

  // Get conversation history
  async getConversationHistory(channel: string, options: {
    cursor?: string;
    latest?: string;
    oldest?: string;
    inclusive?: boolean;
    limit?: number;
  } = {}): Promise<SlackConversationHistoryResponse> {
    const params: Record<string, string | number | boolean> = { channel };
    if (options.cursor) params.cursor = options.cursor;
    if (options.latest) params.latest = options.latest;
    if (options.oldest) params.oldest = options.oldest;
    if (options.inclusive !== undefined) params.inclusive = options.inclusive;
    if (options.limit) params.limit = options.limit;

    return this.request('conversations.history', params) as Promise<SlackConversationHistoryResponse>;
  }

  // Get conversation replies (thread)
  async getConversationReplies(channel: string, ts: string, options: {
    cursor?: string;
    latest?: string;
    oldest?: string;
    inclusive?: boolean;
    limit?: number;
  } = {}): Promise<SlackConversationHistoryResponse> {
    const params: Record<string, string | number | boolean> = { channel, ts };
    if (options.cursor) params.cursor = options.cursor;
    if (options.latest) params.latest = options.latest;
    if (options.oldest) params.oldest = options.oldest;
    if (options.inclusive !== undefined) params.inclusive = options.inclusive;
    if (options.limit) params.limit = options.limit;

    return this.request('conversations.replies', params) as Promise<SlackConversationHistoryResponse>;
  }

  // Post message
  async postMessage(channel: string, text: string, options: {
    thread_ts?: string;
  } = {}): Promise<SlackPostMessageResponse> {
    const params: Record<string, string> = { channel, text };
    if (options.thread_ts) params.thread_ts = options.thread_ts;

    return this.request('chat.postMessage', params) as Promise<SlackPostMessageResponse>;
  }

  // Get user info
  async getUserInfo(userId: string): Promise<SlackUserInfoResponse> {
    return this.request('users.info', { user: userId }) as Promise<SlackUserInfoResponse>;
  }

  // Get multiple users info
  async getUsersInfo(userIds: string[]): Promise<SlackUsersInfoResponse> {
    const users: SlackUser[] = [];

    for (const userId of userIds) {
      try {
        const response = await this.getUserInfo(userId);
        if (response.ok && response.user) {
          users.push(response.user);
        }
      } catch {
        // Skip users we can't fetch
        console.error(`Failed to fetch user ${userId}`);
      }
    }

    return { ok: true, users };
  }

  // Open a conversation (DM)
  async openConversation(users: string): Promise<SlackConversationOpenResponse> {
    return this.request('conversations.open', { users }) as Promise<SlackConversationOpenResponse>;
  }

  // Add reaction to message
  async addReaction(channel: string, timestamp: string, name: string): Promise<SlackReactionResponse> {
    return this.request('reactions.add', {
      channel,
      timestamp,
      name
    }) as Promise<SlackReactionResponse>;
  }

  // Remove reaction from message
  async removeReaction(channel: string, timestamp: string, name: string): Promise<SlackReactionResponse> {
    return this.request('reactions.remove', {
      channel,
      timestamp,
      name
    }) as Promise<SlackReactionResponse>;
  }

  // Search messages and files
  async searchAll(query: string, options: {
    sort?: string;
    sort_dir?: string;
    count?: number;
    page?: number;
  } = {}): Promise<SlackSearchResponse> {
    const params: Record<string, string> = { query };
    if (options.sort) params.sort = options.sort;
    if (options.sort_dir) params.sort_dir = options.sort_dir;
    if (options.count) params.count = String(options.count);
    if (options.page) params.page = String(options.page);

    return this.request('search.all', params) as Promise<SlackSearchResponse>;
  }

  // Get presigned upload URL (step 1 of 3-step upload)
  async getUploadUrl(filename: string, length: number): Promise<FileUploadUrlResponse> {
    return this.request('files.getUploadURLExternal', {
      filename,
      length: String(length),
    }) as Promise<FileUploadUrlResponse>;
  }

  // Upload file content to presigned URL (step 2 of 3-step upload)
  // This is a direct POST to an external URL — no Slack auth needed
  async uploadToUrl(uploadUrl: string, fileContent: Uint8Array, filename: string): Promise<void> {
    const formData = new FormData();
    formData.append('file', new Blob([fileContent]), filename);

    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`File upload failed: HTTP ${response.status}`);
    }
  }

  // Complete upload and share to channel/thread (step 3 of 3-step upload)
  async completeUpload(files: Array<{ id: string; title?: string }>, options: {
    channel_id?: string;
    thread_ts?: string;
    initial_comment?: string;
  } = {}): Promise<FileUploadCompleteResponse> {
    const params: Record<string, string> = {
      files: JSON.stringify(files),
    };
    if (options.channel_id) params.channel_id = options.channel_id;
    if (options.thread_ts) params.thread_ts = options.thread_ts;
    if (options.initial_comment) params.initial_comment = options.initial_comment;

    return this.request('files.completeUploadExternal', params) as Promise<FileUploadCompleteResponse>;
  }

  // Upload one or more files end-to-end, bundled into a single message
  async uploadFiles(filePaths: string[], options: {
    channel_id?: string;
    thread_ts?: string;
    titles?: string[];
    initial_comment?: string;
    onProgress?: (step: string) => void;
  } = {}): Promise<FileUploadCompleteResponse> {
    const fileEntries: Array<{ id: string; title?: string }> = [];

    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      const file = Bun.file(filePath);
      const fileContent = new Uint8Array(await file.arrayBuffer());
      const filename = filePath.split('/').pop() || 'file';
      const length = fileContent.byteLength;

      options.onProgress?.(`Uploading file ${i + 1}/${filePaths.length}: ${filename}`);
      const { upload_url, file_id } = await this.getUploadUrl(filename, length);
      await this.uploadToUrl(upload_url, fileContent, filename);

      const entry: { id: string; title?: string } = { id: file_id };
      if (options.titles?.[i]) entry.title = options.titles[i];
      fileEntries.push(entry);
    }

    options.onProgress?.('Finalizing upload...');
    return this.completeUpload(fileEntries, {
      channel_id: options.channel_id,
      thread_ts: options.thread_ts,
      initial_comment: options.initial_comment,
    });
  }
}
