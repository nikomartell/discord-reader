import { neon } from "@neondatabase/serverless";
import { and, eq, gt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  content: text("content").notNull(),
  authorId: text("author_id").notNull(),
  authorName: text("author_name").notNull(),
  guildId: text("guild_id"),
  channelId: text("channel_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const voiceSessions = pgTable("voice_sessions", {
  guildId: text("guild_id").primaryKey(),
  voiceChannelId: text("voice_channel_id"),
  pendingUserId: text("pending_user_id"),
  requestedByUserId: text("requested_by_user_id").notNull(),
  status: text("status").notNull().default("pending"),
  lastMessageSeenAt: timestamp("last_message_seen_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

let db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!db) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not configured");
    }
    db = drizzle(neon(url));
  }
  return db;
}

export async function getConnectedSessions() {
  return getDb()
    .select()
    .from(voiceSessions)
    .where(eq(voiceSessions.status, "connected"));
}

export async function getPendingSessions() {
  return getDb()
    .select()
    .from(voiceSessions)
    .where(eq(voiceSessions.status, "pending"));
}

export async function updateSessionStatus(
  guildId: string,
  status: "pending" | "connected" | "error",
  voiceChannelId?: string | null,
) {
  await getDb()
    .update(voiceSessions)
    .set({
      status,
      voiceChannelId: voiceChannelId ?? null,
      pendingUserId: null,
      updatedAt: new Date(),
    })
    .where(eq(voiceSessions.guildId, guildId));
}

export async function touchLastMessageSeen(guildId: string, seenAt: Date) {
  await getDb()
    .update(voiceSessions)
    .set({
      lastMessageSeenAt: seenAt,
      updatedAt: new Date(),
    })
    .where(eq(voiceSessions.guildId, guildId));
}

export async function getMessagesSinceForGuild(guildId: string, since: Date) {
  return getDb()
    .select()
    .from(messages)
    .where(and(eq(messages.guildId, guildId), gt(messages.createdAt, since)))
    .orderBy(messages.createdAt);
}
