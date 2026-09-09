import type { RESTPostAPIChatInputApplicationCommandsJSONBody } from "discord-api-types/v10";

export const POST_COMMAND: RESTPostAPIChatInputApplicationCommandsJSONBody = {
  name: "post",
  description: "Publish a message to the public website feed",
  options: [
    {
      type: 3,
      name: "message",
      description: "The message to publish",
      required: true,
      max_length: 2000,
    },
  ],
};

export const SETVOICE_COMMAND: RESTPostAPIChatInputApplicationCommandsJSONBody =
  {
    name: "setvoice",
    description: "Choose the ElevenLabs voice used when your messages are read aloud",
    options: [
      {
        type: 3,
        name: "voice",
        description: "Search for an ElevenLabs voice",
        required: true,
        autocomplete: true,
      },
    ],
  };

export const VOICE_COMMAND: RESTPostAPIChatInputApplicationCommandsJSONBody = {
  name: "voice",
  description: "Show your current read-aloud voice preference",
};

export const COMMANDS = [POST_COMMAND, SETVOICE_COMMAND, VOICE_COMMAND] as const;
