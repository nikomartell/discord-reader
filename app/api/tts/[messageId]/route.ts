import { synthesize } from "@/lib/elevenlabs/client";
import { getMessageById } from "@/lib/messages";
import { getVoiceForAuthor } from "@/lib/voices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MESSAGE_AGE_MS = 10 * 60 * 1000;

export async function GET(
  request: Request,
  context: { params: Promise<{ messageId: string }> },
) {
  if (!process.env.ELEVENLABS_API_KEY || !process.env.ELEVENLABS_DEFAULT_VOICE_ID) {
    return new Response("TTS is not configured", { status: 503 });
  }

  const { messageId } = await context.params;
  const { searchParams } = new URL(request.url);
  const isReplay = searchParams.get("replay") === "1";
  const message = await getMessageById(messageId);

  if (!message) {
    return new Response("Message not found", { status: 404 });
  }

  const ageMs = Date.now() - message.createdAt.getTime();
  if (!isReplay && ageMs > MAX_MESSAGE_AGE_MS) {
    return new Response("Message is too old for TTS", { status: 410 });
  }

  const voice = await getVoiceForAuthor(message.authorId);
  const text = `${message.authorName} says: ${message.content}`;

  try {
    const audio = await synthesize(text, voice.voiceId);

    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("TTS synthesis failed:", error);
    return new Response("Failed to synthesize speech", { status: 502 });
  }
}
