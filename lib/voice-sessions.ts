import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { voiceSessions, type VoiceSession } from "@/lib/db/schema";

export type VoiceSessionStatus = "pending" | "connected" | "error";

export async function upsertSession(data: {
  guildId: string;
  voiceChannelId?: string | null;
  pendingUserId?: string | null;
  requestedByUserId: string;
  status?: VoiceSessionStatus;
}): Promise<VoiceSession> {
  const db = getDb();
  const [session] = await db
    .insert(voiceSessions)
    .values({
      guildId: data.guildId,
      voiceChannelId: data.voiceChannelId ?? null,
      pendingUserId: data.pendingUserId ?? null,
      requestedByUserId: data.requestedByUserId,
      status: data.status ?? "pending",
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: voiceSessions.guildId,
      set: {
        voiceChannelId: data.voiceChannelId ?? null,
        pendingUserId: data.pendingUserId ?? null,
        requestedByUserId: data.requestedByUserId,
        status: data.status ?? "pending",
        updatedAt: new Date(),
      },
    })
    .returning();

  return session;
}

export async function updateSessionStatus(
  guildId: string,
  status: VoiceSessionStatus,
  voiceChannelId?: string | null,
): Promise<void> {
  const db = getDb();
  await db
    .update(voiceSessions)
    .set({
      status,
      voiceChannelId: voiceChannelId ?? null,
      pendingUserId: null,
      updatedAt: new Date(),
    })
    .where(eq(voiceSessions.guildId, guildId));
}

export async function clearSession(guildId: string): Promise<void> {
  const db = getDb();
  await db.delete(voiceSessions).where(eq(voiceSessions.guildId, guildId));
}

export async function getSession(
  guildId: string,
): Promise<VoiceSession | null> {
  const db = getDb();
  const [session] = await db
    .select()
    .from(voiceSessions)
    .where(eq(voiceSessions.guildId, guildId))
    .limit(1);

  return session ?? null;
}

export async function getActiveSessions(): Promise<VoiceSession[]> {
  const db = getDb();
  return db
    .select()
    .from(voiceSessions)
    .where(eq(voiceSessions.status, "connected"));
}

export async function touchLastMessageSeen(
  guildId: string,
  seenAt: Date,
): Promise<void> {
  const db = getDb();
  await db
    .update(voiceSessions)
    .set({
      lastMessageSeenAt: seenAt,
      updatedAt: new Date(),
    })
    .where(eq(voiceSessions.guildId, guildId));
}
