import {
  AudioPlayer,
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  StreamType,
  type VoiceConnection,
} from "@discordjs/voice";
import { Readable } from "node:stream";

import { fetchTtsAudio } from "./tts-client.js";

type GuildQueue = {
  player: AudioPlayer;
  queue: string[];
  playing: boolean;
};

export class PlaybackQueueManager {
  private readonly queues = new Map<string, GuildQueue>();

  enqueue(guildId: string, connection: VoiceConnection, messageId: string) {
    let queue = this.queues.get(guildId);

    if (!queue) {
      const player = createAudioPlayer();
      connection.subscribe(player);
      queue = { player, queue: [], playing: false };
      this.queues.set(guildId, queue);
    }

    if (!queue.queue.includes(messageId)) {
      queue.queue.push(messageId);
    }

    void this.processQueue(guildId);
  }

  clear(guildId: string) {
    const queue = this.queues.get(guildId);
    if (!queue) {
      return;
    }

    queue.queue.length = 0;
    queue.player.stop(true);
    this.queues.delete(guildId);
  }

  private async processQueue(guildId: string) {
    const queue = this.queues.get(guildId);
    if (!queue || queue.playing) {
      return;
    }

    queue.playing = true;

    while (queue.queue.length > 0) {
      const messageId = queue.queue.shift();
      if (!messageId) {
        continue;
      }

      try {
        const audio = await fetchTtsAudio(messageId);
        const resource = createAudioResource(
          Readable.from(Buffer.from(audio)),
          { inputType: StreamType.Arbitrary },
        );

        queue.player.play(resource);
        await entersState(queue.player, AudioPlayerStatus.Idle, 120_000);
      } catch (error) {
        console.error(`Playback failed for message ${messageId}:`, error);
      }
    }

    queue.playing = false;
  }
}
