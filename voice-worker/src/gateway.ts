import {
  Client,
  GatewayIntentBits,
  type Guild,
  type VoiceBasedChannel,
} from "discord.js";
import {
  getVoiceConnection,
  joinVoiceChannel,
  type VoiceConnection,
} from "@discordjs/voice";

export type DiscordGateway = {
  client: Client;
  login: () => Promise<void>;
  joinChannel: (
    guildId: string,
    channelId: string,
  ) => Promise<{ connection: VoiceConnection; channelName: string }>;
  leaveChannel: (guildId: string) => void;
  resolveUserVoiceChannel: (
    guildId: string,
    userId: string,
  ) => VoiceBasedChannel | null;
};

export function createGateway(): DiscordGateway {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  });

  async function getGuild(guildId: string): Promise<Guild> {
    const guild =
      client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId));
    return guild;
  }

  return {
    client,

    async login() {
      const token = process.env.DISCORD_BOT_TOKEN;
      if (!token) {
        throw new Error("DISCORD_BOT_TOKEN is not configured");
      }
      await client.login(token);
      await new Promise<void>((resolve) => {
        if (client.isReady()) {
          resolve();
          return;
        }
        client.once("ready", () => resolve());
      });
    },

    async joinChannel(guildId: string, channelId: string) {
      const guild = await getGuild(guildId);
      const channel = await guild.channels.fetch(channelId);

      if (!channel || !channel.isVoiceBased()) {
        throw new Error("Voice channel not found.");
      }

      const existing = getVoiceConnection(guildId);
      existing?.destroy();

      const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false,
      });

      return { connection, channelName: channel.name };
    },

    leaveChannel(guildId: string) {
      const connection = getVoiceConnection(guildId);
      connection?.destroy();
    },

    resolveUserVoiceChannel(guildId: string, userId: string) {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        return null;
      }

      const member = guild.members.cache.get(userId);
      const channel = member?.voice.channel;
      return channel?.isVoiceBased() ? channel : null;
    },
  };
}
