import { getMessagesSince, getRecentMessages } from "@/lib/messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLL_INTERVAL_MS = 3000;

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return new Response("Database not configured", { status: 503 });
  }

  const encoder = new TextEncoder();
  let lastSeen = new Date(0);
  let cancelled = false;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const initial = await getRecentMessages(50);
        const ordered = [...initial].reverse();

        for (const message of ordered) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(message)}\n\n`),
          );
          const createdAt = new Date(message.createdAt);
          if (createdAt > lastSeen) {
            lastSeen = createdAt;
          }
        }

        controller.enqueue(encoder.encode(": connected\n\n"));

        while (!cancelled) {
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

          if (cancelled) {
            break;
          }

          const newMessages = await getMessagesSince(lastSeen);

          for (const message of newMessages) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(message)}\n\n`),
            );
            const createdAt = new Date(message.createdAt);
            if (createdAt > lastSeen) {
              lastSeen = createdAt;
            }
          }

          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        }
      } catch (error) {
        console.error("SSE stream failed:", error);
        controller.error(error);
      }
    },
    cancel() {
      cancelled = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
