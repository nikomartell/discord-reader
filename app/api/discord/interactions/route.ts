import { verifyDiscordRequest } from "@/lib/discord/verify";
import { handleInteraction } from "@/lib/discord/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const publicKey = process.env.DISCORD_PUBLIC_KEY;

  if (!publicKey) {
    return new Response("Server misconfigured", { status: 500 });
  }

  const verification = await verifyDiscordRequest(request, publicKey);

  if (!verification.valid) {
    return new Response("Invalid request signature", { status: 401 });
  }

  try {
    return await handleInteraction(verification.body);
  } catch (error) {
    console.error("Discord interaction handler failed:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
