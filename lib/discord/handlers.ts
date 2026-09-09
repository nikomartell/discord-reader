import {
  InteractionResponseFlags,
  InteractionResponseType,
  InteractionType,
} from "discord-interactions";
import type { APIChatInputApplicationCommandInteraction } from "discord-api-types/v10";

import { insertMessage } from "@/lib/messages";

function getStringOption(
  interaction: APIChatInputApplicationCommandInteraction,
  name: string,
): string | null {
  const option = interaction.data.options?.find(
    (entry) => entry.name === name && entry.type === 3,
  );

  return option && "value" in option ? String(option.value) : null;
}

function sanitizeContent(content: string): string {
  return content
    .replace(/@everyone/gi, "@\u200beveryone")
    .replace(/@here/gi, "@\u200bhere")
    .trim();
}

export async function handleApplicationCommand(
  interaction: APIChatInputApplicationCommandInteraction,
) {
  if (interaction.data.name !== "post") {
    return Response.json(
      {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: "Unknown command.",
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      },
      { status: 200 },
    );
  }

  const rawMessage = getStringOption(interaction, "message");

  if (!rawMessage) {
    return Response.json(
      {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: "Please provide a message to post.",
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      },
      { status: 200 },
    );
  }

  const content = sanitizeContent(rawMessage);

  if (!content) {
    return Response.json(
      {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: "Message cannot be empty.",
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      },
      { status: 200 },
    );
  }

  const author = interaction.member?.user ?? interaction.user;

  if (!author) {
    return Response.json(
      {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: "Could not identify the author for this message.",
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      },
      { status: 200 },
    );
  }

  await insertMessage({
    content,
    authorId: author.id,
    authorName: author.global_name ?? author.username,
    guildId: interaction.guild_id ?? null,
    channelId: interaction.channel?.id ?? interaction.channel_id ?? null,
  });

  return Response.json(
    {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "Posted to the feed!",
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    },
    { status: 200 },
  );
}

export async function handleInteraction(body: string) {
  const interaction = JSON.parse(body) as { type: InteractionType };

  if (interaction.type === InteractionType.PING) {
    return Response.json({ type: InteractionResponseType.PONG });
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    return handleApplicationCommand(
      JSON.parse(body) as APIChatInputApplicationCommandInteraction,
    );
  }

  return Response.json({ error: "Unsupported interaction type" }, { status: 400 });
}
