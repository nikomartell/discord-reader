import { InteractionResponseFlags } from "discord-interactions";
import type { APIChatInputApplicationCommandInteraction } from "discord-api-types/v10";

export async function sendEphemeralFollowUp(
  interaction: APIChatInputApplicationCommandInteraction,
  content: string,
): Promise<void> {
  const appId = process.env.DISCORD_APP_ID;

  if (!appId) {
    console.error("DISCORD_APP_ID is not configured for follow-up messages");
    return;
  }

  const url = `https://discord.com/api/v10/webhooks/${appId}/${interaction.token}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content,
      flags: InteractionResponseFlags.EPHEMERAL,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("Discord follow-up failed:", response.status, body);
  }
}
