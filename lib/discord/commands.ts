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

export const COMMANDS = [POST_COMMAND] as const;
