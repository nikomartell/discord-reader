import { COMMANDS } from "../lib/discord/commands";

const appId = process.env.DISCORD_APP_ID;
const botToken = process.env.DISCORD_BOT_TOKEN;

if (!appId || !botToken) {
  console.error("Missing DISCORD_APP_ID or DISCORD_BOT_TOKEN.");
  process.exit(1);
}

const guildId = process.argv.find((arg) => arg.startsWith("--guild="))?.split("=")[1];

async function registerCommands() {
  const url = guildId
    ? `https://discord.com/api/v10/applications/${appId}/guilds/${guildId}/commands`
    : `https://discord.com/api/v10/applications/${appId}/commands`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(COMMANDS),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Failed to register commands:", data);
    process.exit(1);
  }

  console.log(
    guildId
      ? `Registered ${COMMANDS.length} guild command(s) for guild ${guildId}.`
      : `Registered ${COMMANDS.length} global command(s).`,
  );
  console.log(JSON.stringify(data, null, 2));
}

registerCommands().catch((error) => {
  console.error(error);
  process.exit(1);
});
