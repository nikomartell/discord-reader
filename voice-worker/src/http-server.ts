import http from "node:http";

import { getMessageById, touchLastMessageSeen } from "./db.js";
import type { PlaybackQueueManager } from "./playback-queue.js";
import type { SessionManager } from "./session-manager.js";

function isAuthorized(request: http.IncomingMessage): boolean {
  const secret = process.env.VOICE_WORKER_SECRET;
  if (!secret) {
    return false;
  }

  const auth = request.headers.authorization;
  return auth === `Bearer ${secret}`;
}

function readJsonBody<T>(request: http.IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    request.on("data", (chunk) => {
      chunks.push(Buffer.from(chunk));
    });

    request.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? (JSON.parse(raw) as T) : ({} as T));
      } catch (error) {
        reject(error);
      }
    });

    request.on("error", reject);
  });
}

function sendJson(
  response: http.ServerResponse,
  status: number,
  body: unknown,
) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

export function createHttpServer(
  sessions: SessionManager,
  playback: PlaybackQueueManager,
): http.Server {
  return http.createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (!isAuthorized(request)) {
      sendJson(response, 401, { ok: false, error: "Unauthorized" });
      return;
    }

    try {
      if (request.method === "POST" && request.url === "/events/join") {
        const body = await readJsonBody<{
          guildId: string;
          channelId?: string | null;
          userId: string;
        }>(request);

        const result = await sessions.joinGuild(body);
        sendJson(response, result.ok ? 200 : 400, result);
        return;
      }

      if (request.method === "POST" && request.url === "/events/message") {
        const body = await readJsonBody<{
          messageId: string;
          guildId: string;
        }>(request);

        const connection = sessions.getConnection(body.guildId);
        if (connection) {
          const enqueued = playback.enqueue(
            body.guildId,
            connection,
            body.messageId,
          );

          if (enqueued) {
            const message = await getMessageById(body.messageId);
            if (message?.createdAt) {
              await touchLastMessageSeen(body.guildId, message.createdAt);
            }
          }
        }

        sendJson(response, 202, { ok: true });
        return;
      }

      if (request.method === "POST" && request.url === "/events/leave") {
        const body = await readJsonBody<{ guildId: string }>(request);
        sessions.leaveGuild(body.guildId);
        sendJson(response, 200, { ok: true });
        return;
      }

      sendJson(response, 404, { ok: false, error: "Not found" });
    } catch (error) {
      console.error("HTTP server error:", error);
      sendJson(response, 500, { ok: false, error: "Internal server error" });
    }
  });
}
