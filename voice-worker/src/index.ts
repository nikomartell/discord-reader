import { createHttpServer } from "./http-server.js";
import { createGateway } from "./gateway.js";
import { startMessagePoller } from "./message-poller.js";
import { PlaybackQueueManager } from "./playback-queue.js";
import { createSessionManager } from "./session-manager.js";

async function main() {
  const gateway = createGateway();
  const playback = new PlaybackQueueManager();
  const sessions = createSessionManager(gateway, playback);

  await gateway.login();
  console.log("Discord gateway connected");

  await sessions.restoreSessions();
  console.log("Voice sessions restored");

  startMessagePoller(sessions, playback);

  const port = Number(process.env.PORT ?? 3100);
  const server = createHttpServer(sessions, playback);

  server.listen(port, () => {
    console.log(`Voice worker listening on port ${port}`);
  });
}

main().catch((error) => {
  console.error("Voice worker failed to start:", error);
  process.exit(1);
});
