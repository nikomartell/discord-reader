import { after } from "next/server";
import {
  InteractionResponseFlags,
  InteractionResponseType,
  InteractionType,
} from "discord-interactions";
import type {
  APIApplicationCommandAutocompleteInteraction,
  APIChatInputApplicationCommandInteraction,
} from "discord-api-types/v10";

import { sendEphemeralFollowUp } from "@/lib/discord/follow-up";
import {
  notifyWorkerLeave,
  notifyWorkerMessage,
  requestWorkerJoin,
} from "@/lib/discord/voice-worker";
import { insertMessage } from "@/lib/messages";
import { clearSession, upsertSession } from "@/lib/voice-sessions";
import {
  getVoiceForAuthor,
  resolveVoiceChoice,
  searchVoices,
  setVoicePreference,
} from "@/lib/voices";

function ephemeral(content: string) {
  return Response.json(
    {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content,
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    },
    { status: 200 },
  );
}

function deferred() {
  return Response.json({
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
  });
}

function getStringOption(
  interaction: APIChatInputApplicationCommandInteraction,
  name: string,
): string | null {
  const option = interaction.data.options?.find(
    (entry) => entry.name === name && entry.type === 3,
  );

  return option && "value" in option ? String(option.value) : null;
}

function getChannelOption(
  interaction: APIChatInputApplicationCommandInteraction,
  name: string,
): string | null {
  const option = interaction.data.options?.find(
    (entry) => entry.name === name && entry.type === 7,
  );

  return option && "value" in option ? String(option.value) : null;
}

function getInvokingUser(
  interaction: APIChatInputApplicationCommandInteraction,
) {
  return interaction.member?.user ?? interaction.user;
}

function sanitizeContent(content: string): string {
  return content
    .replace(/@everyone/gi, "@\u200beveryone")
    .replace(/@here/gi, "@\u200bhere")
    .trim();
}

async function handlePostCommand(
  interaction: APIChatInputApplicationCommandInteraction,
) {
  const rawMessage = getStringOption(interaction, "message");

  if (!rawMessage) {
    return ephemeral("Please provide a message to post.");
  }

  const content = sanitizeContent(rawMessage);

  if (!content) {
    return ephemeral("Message cannot be empty.");
  }

  const author = getInvokingUser(interaction);

  if (!author) {
    return ephemeral("Could not identify the author for this message.");
  }

  const message = await insertMessage({
    content,
    authorId: author.id,
    authorName: author.global_name ?? author.username,
    guildId: interaction.guild_id ?? null,
    channelId: interaction.channel?.id ?? interaction.channel_id ?? null,
  });

  notifyWorkerMessage({
    messageId: message.id,
    guildId: interaction.guild_id ?? null,
  });

  return ephemeral("Posted to the feed!");
}

async function handleSetVoiceCommand(
  interaction: APIChatInputApplicationCommandInteraction,
) {
  const voiceId = getStringOption(interaction, "voice");
  const user = getInvokingUser(interaction);

  if (!user) {
    return ephemeral("Could not identify your Discord account.");
  }

  if (!voiceId) {
    return ephemeral("Please choose a voice.");
  }

  const voice = await resolveVoiceChoice(voiceId);

  if (!voice) {
    return ephemeral("That voice is no longer available. Try searching again.");
  }

  await setVoicePreference(user.id, voice.voiceId, voice.name);

  return ephemeral(`Your voice is now **${voice.name}**.`);
}

async function handleVoiceCommand(
  interaction: APIChatInputApplicationCommandInteraction,
) {
  const user = getInvokingUser(interaction);

  if (!user) {
    return ephemeral("Could not identify your Discord account.");
  }

  const voice = await getVoiceForAuthor(user.id);

  if (voice.isDefault) {
    return ephemeral(
      `Using default voice (**${voice.voiceName}**). Run \`/setvoice\` to change it.`,
    );
  }

  return ephemeral(`Your current voice is **${voice.voiceName}**.`);
}

function handleJoinCommand(
  interaction: APIChatInputApplicationCommandInteraction,
) {
  if (!interaction.guild_id) {
    return ephemeral("/join can only be used in a server.");
  }

  const user = getInvokingUser(interaction);

  if (!user) {
    return ephemeral("Could not identify your Discord account.");
  }

  const guildId = interaction.guild_id;
  const channelId = getChannelOption(interaction, "channel");

  after(async () => {
    try {
      await upsertSession({
        guildId,
        voiceChannelId: channelId,
        pendingUserId: channelId ? null : user.id,
        requestedByUserId: user.id,
        status: "pending",
      });

      const result = await requestWorkerJoin({
        guildId,
        channelId,
        userId: user.id,
      });

      if (result.ok) {
        const message = channelId
          ? `Joined **${result.channelName}**.`
          : `Joined your voice channel (**${result.channelName}**).`;
        await sendEphemeralFollowUp(interaction, message);
        return;
      }

      await sendEphemeralFollowUp(interaction, result.error);
    } catch (error) {
      console.error("Join command follow-up failed:", error);
      await sendEphemeralFollowUp(
        interaction,
        "Could not reach voice service. Try again.",
      );
    }
  });

  return deferred();
}

async function handleLeaveCommand(
  interaction: APIChatInputApplicationCommandInteraction,
) {
  if (!interaction.guild_id) {
    return ephemeral("/leave can only be used in a server.");
  }

  await clearSession(interaction.guild_id);
  notifyWorkerLeave({ guildId: interaction.guild_id });

  return ephemeral("Left the voice channel.");
}

async function handleAutocomplete(
  interaction: APIApplicationCommandAutocompleteInteraction,
) {
  if (interaction.data.name !== "setvoice") {
    return Response.json({ type: InteractionResponseType.PONG });
  }

  const focusedOption = interaction.data.options.find(
    (option) => "focused" in option && option.focused === true,
  );

  if (!focusedOption || focusedOption.name !== "voice") {
    return Response.json({
      type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
      data: { choices: [] },
    });
  }

  const query =
    focusedOption.type === 3 && "value" in focusedOption
      ? String(focusedOption.value)
      : "";

  try {
    const voices = await searchVoices(query);
    const choices = voices.slice(0, 25).map((voice) => ({
      name: voice.name.slice(0, 100),
      value: voice.voiceId,
    }));

    return Response.json({
      type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
      data: { choices },
    });
  } catch (error) {
    console.error("Voice autocomplete failed:", error);
    return Response.json({
      type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
      data: { choices: [] },
    });
  }
}

export async function handleApplicationCommand(
  interaction: APIChatInputApplicationCommandInteraction,
) {
  switch (interaction.data.name) {
    case "post":
      return handlePostCommand(interaction);
    case "setvoice":
      return handleSetVoiceCommand(interaction);
    case "voice":
      return handleVoiceCommand(interaction);
    case "join":
      return handleJoinCommand(interaction);
    case "leave":
      return handleLeaveCommand(interaction);
    default:
      return ephemeral("Unknown command.");
  }
}

export async function handleInteraction(body: string) {
  const interaction = JSON.parse(body) as { type: InteractionType };

  if (interaction.type === InteractionType.PING) {
    return Response.json({ type: InteractionResponseType.PONG });
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE) {
    return handleAutocomplete(
      JSON.parse(body) as APIApplicationCommandAutocompleteInteraction,
    );
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    return handleApplicationCommand(
      JSON.parse(body) as APIChatInputApplicationCommandInteraction,
    );
  }

  return Response.json({ error: "Unsupported interaction type" }, { status: 400 });
}
