import { synthesize } from "@/lib/elevenlabs/client";
import { getMessageById } from "@/lib/messages";
import { getVoiceForAuthor } from "@/lib/voices";

const MAX_MESSAGE_AGE_MS = 10 * 60 * 1000;

export type SynthesizeMessageResult =
  | { ok: true; audio: ArrayBuffer }
  | { ok: false; status: number; message: string };

export async function synthesizeMessage(
  messageId: string,
  options: { allowStale?: boolean } = {},
): Promise<SynthesizeMessageResult> {
  if (!process.env.ELEVENLABS_API_KEY || !process.env.ELEVENLABS_DEFAULT_VOICE_ID) {
    return { ok: false, status: 503, message: "TTS is not configured" };
  }

  const message = await getMessageById(messageId);

  if (!message) {
    return { ok: false, status: 404, message: "Message not found" };
  }

  const ageMs = Date.now() - message.createdAt.getTime();
  if (!options.allowStale && ageMs > MAX_MESSAGE_AGE_MS) {
    return { ok: false, status: 410, message: "Message is too old for TTS" };
  }

  const voice = await getVoiceForAuthor(message.authorId);

  try {
    const audio = await synthesize(message.content, voice.voiceId);
    return { ok: true, audio };
  } catch (error) {
    console.error("TTS synthesis failed:", error);
    return { ok: false, status: 502, message: "Failed to synthesize speech" };
  }
}

export function isAuthorizedWorkerRequest(request: Request): boolean {
  const secret = process.env.VOICE_WORKER_SECRET;
  if (!secret) {
    return false;
  }

  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}
