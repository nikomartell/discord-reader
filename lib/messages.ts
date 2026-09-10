import { and, desc, eq, gt, lt } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { messages, type Message } from "@/lib/db/schema";

export type MessageItem = {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
};

export function toMessageItem(message: Message): MessageItem {
  return {
    id: message.id,
    content: message.content,
    authorId: message.authorId,
    authorName: message.authorName,
    createdAt: message.createdAt.toISOString(),
  };
}

export async function getMessageById(id: string): Promise<Message | null> {
  const db = getDb();
  const [message] = await db
    .select()
    .from(messages)
    .where(eq(messages.id, id))
    .limit(1);

  return message ?? null;
}

export async function insertMessage(data: {
  content: string;
  authorId: string;
  authorName: string;
  guildId?: string | null;
  channelId?: string | null;
}) {
  const db = getDb();
  const [message] = await db
    .insert(messages)
    .values({
      content: data.content,
      authorId: data.authorId,
      authorName: data.authorName,
      guildId: data.guildId ?? null,
      channelId: data.channelId ?? null,
    })
    .returning();

  return message;
}

export async function getRecentMessages(limit = 50): Promise<MessageItem[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(messages)
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  return rows.map(toMessageItem);
}

export async function getMessagesSince(since: Date): Promise<MessageItem[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(messages)
    .where(gt(messages.createdAt, since))
    .orderBy(messages.createdAt);

  return rows.map(toMessageItem);
}

export async function getMessagesSinceForGuild(
  guildId: string,
  since: Date,
): Promise<MessageItem[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(messages)
    .where(
      and(eq(messages.guildId, guildId), gt(messages.createdAt, since)),
    )
    .orderBy(messages.createdAt);

  return rows.map(toMessageItem);
}

export async function listMessages(options: {
  limit: number;
  cursor?: string;
}): Promise<{ items: MessageItem[]; nextCursor: string | null }> {
  const db = getDb();
  const { limit, cursor } = options;

  const rows = cursor
    ? await db
        .select()
        .from(messages)
        .where(lt(messages.createdAt, new Date(cursor)))
        .orderBy(desc(messages.createdAt))
        .limit(limit + 1)
    : await db
        .select()
        .from(messages)
        .orderBy(desc(messages.createdAt))
        .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const items = page.map(toMessageItem);
  const nextCursor =
    hasMore && page.length > 0
      ? page[page.length - 1]!.createdAt.toISOString()
      : null;

  return { items, nextCursor };
}

export async function safeGetRecentMessages(
  limit = 50,
): Promise<MessageItem[]> {
  if (!process.env.DATABASE_URL) {
    return [];
  }

  try {
    return await getRecentMessages(limit);
  } catch {
    return [];
  }
}
