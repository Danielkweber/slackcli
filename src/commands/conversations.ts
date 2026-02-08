import { Command } from 'commander';
import ora from 'ora';
import { getAuthenticatedClient } from '../lib/auth.ts';
import { error, formatChannelList, formatChannelListWithUnreads, formatConversationHistory, formatUnreadThreads } from '../lib/formatter.ts';
import type { SlackChannel, SlackMessage, SlackThreadEntry, SlackUser } from '../types/index.ts';

export function createConversationsCommand(): Command {
  const conversations = new Command('conversations')
    .description('Manage Slack conversations (channels, DMs, groups)');

  // List conversations
  conversations
    .command('list')
    .description('List all conversations')
    .option('--types <types>', 'Conversation types (comma-separated: public_channel,private_channel,mpim,im)', 'public_channel,private_channel,mpim,im')
    .option('--limit <number>', 'Number of conversations to return', '100')
    .option('--exclude-archived', 'Exclude archived conversations', false)
    .option('--workspace <id|name>', 'Workspace to use (overrides default)')
    .action(async (options) => {
      const spinner = ora('Fetching conversations...').start();

      try {
        const client = await getAuthenticatedClient(options.workspace);

        const response = await client.listConversations({
          types: options.types,
          limit: parseInt(options.limit),
          exclude_archived: options.excludeArchived,
        });

        const channels: SlackChannel[] = response.channels || [];

        // Fetch user info for DMs
        const userIds = new Set<string>();
        channels.forEach(ch => {
          if (ch.is_im && ch.user) {
            userIds.add(ch.user);
          }
        });

        const users = new Map<string, SlackUser>();
        if (userIds.size > 0) {
          spinner.text = 'Fetching user information...';
          const usersResponse = await client.getUsersInfo(Array.from(userIds));
          usersResponse.users?.forEach((user: SlackUser) => {
            users.set(user.id, user);
          });
        }

        spinner.succeed(`Found ${channels.length} conversations`);

        console.log('\n' + formatChannelList(channels, users));
      } catch (err: any) {
        spinner.fail('Failed to fetch conversations');
        error(err.message, 'Run "slackcli auth list" to check your authentication.');
        process.exit(1);
      }
    });

  // Read conversation history
  conversations
    .command('read')
    .description('Read conversation history or specific thread')
    .argument('<channel-id>', 'Channel ID to read from')
    .option('--thread-ts <timestamp>', 'Thread timestamp to read specific thread')
    .option('--exclude-replies', 'Exclude threaded replies (only top-level messages)', false)
    .option('--limit <number>', 'Number of messages to return', '100')
    .option('--oldest <timestamp>', 'Start of time range')
    .option('--latest <timestamp>', 'End of time range')
    .option('--workspace <id|name>', 'Workspace to use')
    .option('--json', 'Output in JSON format (includes timestamps for replies)', false)
    .action(async (channelId, options) => {
      const spinner = ora('Fetching messages...').start();

      try {
        const client = await getAuthenticatedClient(options.workspace);

        let response: any;
        let messages: SlackMessage[];

        if (options.threadTs) {
          // Fetch thread replies
          spinner.text = 'Fetching thread replies...';
          response = await client.getConversationReplies(channelId, options.threadTs, {
            limit: parseInt(options.limit),
            oldest: options.oldest,
            latest: options.latest,
          });
          messages = response.messages || [];
        } else {
          // Fetch conversation history
          spinner.text = 'Fetching conversation history...';
          response = await client.getConversationHistory(channelId, {
            limit: parseInt(options.limit),
            oldest: options.oldest,
            latest: options.latest,
          });
          messages = response.messages || [];

          // Filter out replies if requested
          if (options.excludeReplies) {
            messages = messages.filter(msg => !msg.thread_ts || msg.thread_ts === msg.ts);
          }
        }

        // Reverse to show oldest first
        messages.reverse();

        // Fetch user info for messages
        const userIds = new Set<string>();
        messages.forEach(msg => {
          if (msg.user) {
            userIds.add(msg.user);
          }
        });

        const users = new Map<string, SlackUser>();
        if (userIds.size > 0) {
          spinner.text = 'Fetching user information...';
          const usersResponse = await client.getUsersInfo(Array.from(userIds));
          usersResponse.users?.forEach((user: SlackUser) => {
            users.set(user.id, user);
          });
        }

        spinner.succeed(`Found ${messages.length} messages`);

        // Output in JSON format if requested
        if (options.json) {
          console.log(JSON.stringify({
            channel_id: channelId,
            message_count: messages.length,
            messages: messages.map(msg => ({
              ts: msg.ts,
              thread_ts: msg.thread_ts,
              user: msg.user,
              text: msg.text,
              type: msg.type,
              reply_count: msg.reply_count,
              reactions: msg.reactions,
              bot_id: msg.bot_id,
            })),
            users: Array.from(users.values()).map(u => ({
              id: u.id,
              name: u.name,
              real_name: u.real_name,
              email: u.profile?.email,
            })),
          }, null, 2));
        } else {
          console.log('\n' + formatConversationHistory(channelId, messages, users));
        }
      } catch (err: any) {
        spinner.fail('Failed to fetch messages');
        error(err.message);
        process.exit(1);
      }
    });

  // List unread conversations
  conversations
    .command('list-unreads')
    .description('List conversations with unread messages')
    .option('--workspace <id|name>', 'Workspace to use (overrides default)')
    .option('--json', 'Output in JSON format', false)
    .action(async (options) => {
      const spinner = ora('Fetching unread counts...').start();

      try {
        const client = await getAuthenticatedClient(options.workspace);

        // Use client.counts API to get unread info
        const counts = await client.getClientCounts();

        // Collect all unread channel/mpim/im entries
        type UnreadEntry = { id: string; mention_count: number; has_unreads: boolean };
        const unreadEntries: UnreadEntry[] = [];

        for (const ch of counts.channels || []) {
          if (ch.has_unreads) unreadEntries.push(ch);
        }
        for (const ch of counts.mpims || []) {
          if (ch.has_unreads) unreadEntries.push(ch);
        }
        for (const ch of counts.ims || []) {
          if (ch.has_unreads) unreadEntries.push(ch);
        }

        // Sort by mention count descending, then alphabetically
        unreadEntries.sort((a, b) => b.mention_count - a.mention_count);

        // Fetch conversation info in parallel to get names
        spinner.text = `Resolving ${unreadEntries.length} channel names...`;
        const mentionCounts = new Map<string, number>();
        for (const entry of unreadEntries) {
          mentionCounts.set(entry.id, entry.mention_count);
        }

        const resolved = await Promise.all(
          unreadEntries.map(async (entry) => {
            try {
              const info = await client.getConversationInfo(entry.id);
              return info.channel as SlackChannel ?? { id: entry.id } as SlackChannel;
            } catch {
              return { id: entry.id } as SlackChannel;
            }
          })
        );
        const channels: SlackChannel[] = resolved;

        // Fetch user info for DMs
        const userIds = new Set<string>();
        channels.forEach(ch => {
          if (ch.is_im && ch.user) {
            userIds.add(ch.user);
          }
        });

        const users = new Map<string, SlackUser>();
        if (userIds.size > 0) {
          spinner.text = 'Fetching user information...';
          const usersResponse = await client.getUsersInfo(Array.from(userIds));
          usersResponse.users?.forEach((user: SlackUser) => {
            users.set(user.id, user);
          });
        }

        spinner.succeed(`Found ${channels.length} conversations with unread messages`);

        if (options.json) {
          console.log(JSON.stringify({
            unread_count: channels.length,
            channels: channels.map(ch => ({
              id: ch.id,
              name: ch.name,
              is_im: ch.is_im,
              is_mpim: ch.is_mpim,
              is_private: ch.is_private,
              mention_count: mentionCounts.get(ch.id) ?? 0,
              user: ch.user,
              user_name: ch.user ? users.get(ch.user)?.real_name || users.get(ch.user)?.name : undefined,
            })),
          }, null, 2));
        } else {
          console.log('\n' + formatChannelListWithUnreads(channels, users, mentionCounts));
        }
      } catch (err: any) {
        spinner.fail('Failed to fetch conversations');
        error(err.message, 'Run "slackcli auth list" to check your authentication.');
        process.exit(1);
      }
    });

  // List unread threads
  conversations
    .command('list-unread-threads')
    .description('List threads with unread replies')
    .option('--limit <number>', 'Number of threads to fetch', '20')
    .option('--all', 'Show all subscribed threads, not just unread', false)
    .option('--workspace <id|name>', 'Workspace to use (overrides default)')
    .option('--json', 'Output in JSON format', false)
    .action(async (options) => {
      const spinner = ora('Fetching thread subscriptions...').start();

      try {
        const client = await getAuthenticatedClient(options.workspace);

        const response = await client.getThreadsView({ limit: parseInt(options.limit) });
        let threads: SlackThreadEntry[] = response.threads || [];

        // Filter to only unread threads unless --all
        if (!options.all) {
          threads = threads.filter((t: SlackThreadEntry) => t.unread_replies && t.unread_replies.length > 0);
        }

        // Resolve channel names in parallel
        spinner.text = `Resolving ${threads.length} thread channels...`;
        const channelIds = new Set(threads.map((t: SlackThreadEntry) => t.root_msg.channel));
        const channelNames = new Map<string, string>();

        await Promise.all(
          Array.from(channelIds).map(async (id) => {
            try {
              const info = await client.getConversationInfo(id);
              if (info.channel?.name) channelNames.set(id, info.channel.name);
            } catch {
              // Skip channels we can't resolve
            }
          })
        );

        // Resolve user names
        spinner.text = 'Fetching user information...';
        const userIds = new Set<string>();
        for (const thread of threads) {
          if (thread.root_msg.user) userIds.add(thread.root_msg.user);
          for (const reply of thread.unread_replies || []) {
            if (reply.user) userIds.add(reply.user);
          }
          for (const reply of thread.latest_replies || []) {
            if (reply.user) userIds.add(reply.user);
          }
        }

        const users = new Map<string, SlackUser>();
        if (userIds.size > 0) {
          const usersResponse = await client.getUsersInfo(Array.from(userIds));
          usersResponse.users?.forEach((user: SlackUser) => {
            users.set(user.id, user);
          });
        }

        const unreadCount = threads.filter((t: SlackThreadEntry) => t.unread_replies && t.unread_replies.length > 0).length;
        spinner.succeed(`Found ${unreadCount} threads with unread replies`);

        if (options.json) {
          console.log(JSON.stringify({
            unread_thread_count: unreadCount,
            total_unread_replies: response.total_unread_replies ?? 0,
            threads: threads.map((t: SlackThreadEntry) => ({
              channel_id: t.root_msg.channel,
              channel_name: channelNames.get(t.root_msg.channel) || t.root_msg.channel,
              root_msg: {
                text: t.root_msg.text,
                user: t.root_msg.user,
                user_name: users.get(t.root_msg.user)?.real_name || users.get(t.root_msg.user)?.name,
                ts: t.root_msg.ts,
                thread_ts: t.root_msg.thread_ts,
                reply_count: t.root_msg.reply_count,
              },
              unread_replies: (t.unread_replies || []).map((r) => ({
                user: r.user,
                user_name: users.get(r.user || '')?.real_name || users.get(r.user || '')?.name,
                text: r.text,
                ts: r.ts,
              })),
            })),
          }, null, 2));
        } else {
          console.log('\n' + formatUnreadThreads(threads, channelNames, users));
        }
      } catch (err: any) {
        spinner.fail('Failed to fetch threads');
        error(err.message, 'Run "slackcli auth list" to check your authentication.');
        process.exit(1);
      }
    });

  // Mark conversation as read
  conversations
    .command('mark-read')
    .description('Mark a conversation as read')
    .argument('<channel-id>', 'Channel ID to mark as read')
    .option('--timestamp <ts>', 'Message timestamp to mark read up to (defaults to latest message)')
    .option('--workspace <id|name>', 'Workspace to use (overrides default)')
    .action(async (channelId, options) => {
      const spinner = ora('Marking conversation as read...').start();

      try {
        const client = await getAuthenticatedClient(options.workspace);

        let ts = options.timestamp;

        // If no timestamp provided, fetch the latest message
        if (!ts) {
          spinner.text = 'Fetching latest message...';
          const history = await client.getConversationHistory(channelId, { limit: 1 });
          const messages: SlackMessage[] = history.messages || [];
          if (messages.length === 0) {
            spinner.succeed('No messages in channel — nothing to mark as read.');
            return;
          }
          ts = messages[0].ts;
        }

        await client.markConversationRead(channelId, ts);
        spinner.succeed(`Marked ${channelId} as read up to ${ts}`);
      } catch (err: any) {
        spinner.fail('Failed to mark conversation as read');
        error(err.message);
        process.exit(1);
      }
    });

  return conversations;
}

