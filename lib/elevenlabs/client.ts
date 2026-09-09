export type ElevenLabsVoice = {
  voiceId: string;
  name: string;
};

type VoicesSearchResponse = {
  voices: Array<{
    voice_id: string;
    name: string;
  }>;
};

const CACHE_TTL_MS = 60 * 60 * 1000;
const voiceSearchCache = new Map<
  string,
  { expiresAt: number; voices: ElevenLabsVoice[] }
>();

function getApiKey() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not configured");
  }
  return apiKey;
}

function getModelId() {
  return process.env.ELEVENLABS_MODEL_ID ?? "eleven_turbo_v2_5";
}

export function getDefaultVoiceId() {
  const voiceId = process.env.ELEVENLABS_DEFAULT_VOICE_ID;
  if (!voiceId) {
    throw new Error("ELEVENLABS_DEFAULT_VOICE_ID is not configured");
  }
  return voiceId;
}

export function getDefaultVoiceName() {
  return process.env.ELEVENLABS_DEFAULT_VOICE_NAME ?? "Default";
}

export async function searchVoices(query = ""): Promise<ElevenLabsVoice[]> {
  const cacheKey = query.trim().toLowerCase() || "__all__";
  const cached = voiceSearchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.voices;
  }

  const params = new URLSearchParams({
    page_size: "25",
    include_total_count: "false",
  });

  if (query.trim()) {
    params.set("search", query.trim());
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v2/voices?${params.toString()}`,
    {
      headers: {
        "xi-api-key": getApiKey(),
      },
      next: { revalidate: 3600 },
    },
  );

  if (!response.ok) {
    throw new Error(`ElevenLabs voice search failed (${response.status})`);
  }

  const data = (await response.json()) as VoicesSearchResponse;
  const voices = data.voices.map((voice) => ({
    voiceId: voice.voice_id,
    name: voice.name,
  }));

  voiceSearchCache.set(cacheKey, {
    voices,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return voices;
}

export async function findVoiceById(
  voiceId: string,
): Promise<ElevenLabsVoice | null> {
  const voices = await searchVoices();
  return voices.find((voice) => voice.voiceId === voiceId) ?? null;
}

export async function synthesize(
  text: string,
  voiceId: string,
): Promise<ArrayBuffer> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": getApiKey(),
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: getModelId(),
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`ElevenLabs synthesis failed (${response.status})`);
  }

  return response.arrayBuffer();
}
