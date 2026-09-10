import {
  isAuthorizedWorkerRequest,
  synthesizeMessage,
} from "@/lib/tts/synthesize-message";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ messageId: string }> },
) {
  const { messageId } = await context.params;
  const { searchParams } = new URL(request.url);
  const isReplay =
    searchParams.get("replay") === "1" || isAuthorizedWorkerRequest(request);

  const result = await synthesizeMessage(messageId, { allowStale: isReplay });

  if (!result.ok) {
    return new Response(result.message, { status: result.status });
  }

  return new Response(result.audio, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
