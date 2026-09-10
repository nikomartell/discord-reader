import {
  getConnectedSessions,
  getMessagesSinceForGuild,
  touchLastMessageSeen,
} from "./db.js";
import type { PlaybackQueueManager } from "./playback-queue.js";
import type { SessionManager } from "./session-manager.js";

const POLL_INTERVAL_MS = 2_500;

export function startMessagePoller(
  sessions: SessionManager,
  playback: PlaybackQueueManager,
) {
  const seenMessageIds = new Set<string>();

  setInterval(async () => {
    try {
      const activeSessions = await getConnectedSessions();

      for (const session of activeSessions) {
        const connection = sessions.getConnection(session.guildId);
        if (!connection) {
          continue;
        }

        const since =
          session.lastMessageSeenAt ??
          new Date(Date.now() - POLL_INTERVAL_MS * 2);
        const messages = await getMessagesSinceForGuild(
          session.guildId,
          since,
        );

        if (messages.length === 0) {
          continue;
        }

        let latestSeen = since;

        for (const message of messages) {
          if (seenMessageIds.has(message.id)) {
            continue;
          }

          seenMessageIds.add(message.id);
          const enqueued = playback.enqueue(
            session.guildId,
            connection,
            message.id,
          );

          if (enqueued && message.createdAt > latestSeen) {
            latestSeen = message.createdAt;
          }
        }

        await touchLastMessageSeen(session.guildId, latestSeen);
      }
    } catch (error) {
      console.error("Message poller failed:", error);
    }
  }, POLL_INTERVAL_MS);
}
