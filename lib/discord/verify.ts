import { verifyKey } from "discord-interactions";

export async function verifyDiscordRequest(
  request: Request,
  publicKey: string,
): Promise<{ valid: true; body: string } | { valid: false }> {
  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");

  if (!signature || !timestamp) {
    return { valid: false };
  }

  const body = await request.text();
  const isValid = await verifyKey(body, signature, timestamp, publicKey);

  if (!isValid) {
    return { valid: false };
  }

  return { valid: true, body };
}
