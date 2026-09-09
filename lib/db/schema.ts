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

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

export const userVoicePreferences = pgTable("user_voice_preferences", {
  discordUserId: text("discord_user_id").primaryKey(),
  elevenlabsVoiceId: text("elevenlabs_voice_id").notNull(),
  voiceName: text("voice_name").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type UserVoicePreference = typeof userVoicePreferences.$inferSelect;
export type NewUserVoicePreference = typeof userVoicePreferences.$inferInsert;
