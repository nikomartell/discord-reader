import type { VoiceConnection } from "@discordjs/voice";

import { updateSessionStatus } from "./db.js";
import type { DiscordGateway } from "./gateway.js";
import type { PlaybackQueueManager } from "./playback-queue.js";

export type SessionManager = {
  joinGuild: (input: {
    guildId: string;
    channelId?: string | null;
    userId: string;
  }) => Promise<
    | { ok: true; channelId: string; channelName: string }
    | { ok: false; error: string }
  >;
  leaveGuild: (guildId: string) => void;
  getConnection: (guildId: string) => VoiceConnection | undefined;
  restoreSessions: () => Promise<void>;
};

export function createSessionManager(
  gateway: DiscordGateway,
  playback: PlaybackQueueManager,
): SessionManager {
  const connections = new Map<string, VoiceConnection>();

  return {
    async joinGuild({ guildId, channelId, userId }) {
      try {
        let targetChannelId: string;

        if (channelId) {
          targetChannelId = channelId;
        } else {
          const userChannel = gateway.resolveUserVoiceChannel(guildId, userId);
          if (!userChannel) {
            await updateSessionStatus(guildId, "error");
            return {
              ok: false,
              error: "Join a voice channel first, or specify one.",
            };
          }
          targetChannelId = userChannel.id;
        }

        const { connection, channelName } = await gateway.joinChannel(
          guildId,
          targetChannelId,
        );

        connections.set(guildId, connection);
        await updateSessionStatus(guildId, "connected", targetChannelId);

        return {
          ok: true,
          channelId: targetChannelId,
          channelName,
        };
      } catch (error) {
        console.error("Failed to join voice channel:", error);
        await updateSessionStatus(guildId, "error");
        return {
          ok: false,
          error: "Could not join voice channel.",
        };
      }
    },

    leaveGuild(guildId: string) {
      playback.clear(guildId);
      gateway.leaveChannel(guildId);
      connections.delete(guildId);
    },

    getConnection(guildId: string) {
      return connections.get(guildId);
    },

    async restoreSessions() {
      const { getConnectedSessions, getPendingSessions } = await import(
        "./db.js"
      );
      const sessions = [
        ...(await getConnectedSessions()),
        ...(await getPendingSessions()),
      ];

      for (const session of sessions) {
        const channelId = session.voiceChannelId;
        const userId = session.pendingUserId ?? session.requestedByUserId;

        if (channelId) {
          await this.joinGuild({
            guildId: session.guildId,
            channelId,
            userId,
          });
          continue;
        }

        await this.joinGuild({
          guildId: session.guildId,
          channelId: null,
          userId,
        });
      }
    },
  };
}
