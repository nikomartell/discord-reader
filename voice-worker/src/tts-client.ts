export async function fetchTtsAudio(messageId: string): Promise<ArrayBuffer> {
  const baseUrl = process.env.VERCEL_URL?.replace(/\/$/, "");
  const secret = process.env.VOICE_WORKER_SECRET;

  if (!baseUrl || !secret) {
    throw new Error("VERCEL_URL or VOICE_WORKER_SECRET is not configured");
  }

  const response = await fetch(`${baseUrl}/api/tts/${messageId}?replay=1`, {
    headers: {
      Authorization: `Bearer ${secret}`,
    },
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`TTS fetch failed (${response.status}): ${body}`);
  }

  return response.arrayBuffer();
}
