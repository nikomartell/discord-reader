import { listMessages } from "@/lib/messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!process.env.DATABASE_URL) {
    return Response.json({ error: "Database not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(
    Math.max(Number(searchParams.get("limit") ?? 50), 1),
    100,
  );
  const cursor = searchParams.get("cursor") ?? undefined;

  try {
    const result = await listMessages({ limit, cursor });
    return Response.json(result);
  } catch (error) {
    console.error("Failed to list messages:", error);
    return Response.json({ error: "Failed to load messages" }, { status: 500 });
  }
}
