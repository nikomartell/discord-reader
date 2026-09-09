import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { userVoicePreferences } from "@/lib/db/schema";
import {
  findVoiceById,
  getDefaultVoiceId,
  getDefaultVoiceName,
  searchVoices as searchElevenLabsVoices,
  type ElevenLabsVoice,
} from "@/lib/elevenlabs/client";

export type ResolvedVoice = {
  voiceId: string;
  voiceName: string;
  isDefault: boolean;
};

export async function getVoiceForAuthor(
  discordUserId: string,
): Promise<ResolvedVoice> {
  const db = getDb();
  const [preference] = await db
    .select()
    .from(userVoicePreferences)
    .where(eq(userVoicePreferences.discordUserId, discordUserId))
    .limit(1);

  if (preference) {
    return {
      voiceId: preference.elevenlabsVoiceId,
      voiceName: preference.voiceName,
      isDefault: false,
    };
  }

  return {
    voiceId: getDefaultVoiceId(),
    voiceName: getDefaultVoiceName(),
    isDefault: true,
  };
}

export async function setVoicePreference(
  discordUserId: string,
  voiceId: string,
  voiceName: string,
) {
  const db = getDb();

  await db
    .insert(userVoicePreferences)
    .values({
      discordUserId,
      elevenlabsVoiceId: voiceId,
      voiceName,
    })
    .onConflictDoUpdate({
      target: userVoicePreferences.discordUserId,
      set: {
        elevenlabsVoiceId: voiceId,
        voiceName,
        updatedAt: new Date(),
      },
    });
}

export async function searchVoices(query: string): Promise<ElevenLabsVoice[]> {
  return searchElevenLabsVoices(query);
}

export async function resolveVoiceChoice(
  voiceId: string,
): Promise<ElevenLabsVoice | null> {
  return findVoiceById(voiceId);
}
