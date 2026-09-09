"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MUTE_STORAGE_KEY = "discord-reader-read-aloud-muted";

/** Minimal silent MP3 — unlocks autoplay when played during a user gesture. */
const SILENT_AUDIO =
  "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYoRwmHAAAAAAD/+1DEAAAHAAGf9AAAIAAANIAAAAQAAAaQAAAAAAA0gAAAAAAABpAAAAAAAAA0gAAAAAAAGkAAAAAAAA=";

async function unlockAudioPlayback() {
  const audio = new Audio(SILENT_AUDIO);
  audio.volume = 0.001;
  try {
    await audio.play();
    audio.pause();
  } catch {
    // Browser may still allow subsequent playback after the gesture.
  }
}

export function useSpeechQueue() {
  const [enabled, setEnabled] = useState(false);
  const [muted, setMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const queueRef = useRef<string[]>([]);
  const processingRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const enabledRef = useRef(false);
  const mutedRef = useRef(false);
  const replayFlagsRef = useRef<Map<string, boolean>>(new Map());

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    setMuted(window.localStorage.getItem(MUTE_STORAGE_KEY) === "true");
  }, []);

  const setMutedPreference = useCallback((value: boolean) => {
    setMuted(value);
    mutedRef.current = value;
    window.localStorage.setItem(MUTE_STORAGE_KEY, String(value));
  }, []);

  const processQueue = useCallback(async () => {
    if (processingRef.current || !enabledRef.current || mutedRef.current) {
      return;
    }

    processingRef.current = true;

    while (
      queueRef.current.length > 0 &&
      enabledRef.current &&
      !mutedRef.current
    ) {
      const messageId = queueRef.current.shift();
      if (!messageId) {
        continue;
      }

      const isReplay = replayFlagsRef.current.get(messageId) ?? false;
      replayFlagsRef.current.delete(messageId);

      try {
        const url = isReplay
          ? `/api/tts/${messageId}?replay=1`
          : `/api/tts/${messageId}`;
        const response = await fetch(url);

        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          if (response.status === 503) {
            setLastError(
              "Read-aloud unavailable — ElevenLabs is not configured on the server.",
            );
          } else if (response.status === 410) {
            setLastError("This message is too old to read aloud automatically.");
          } else {
            setLastError(
              detail || `Could not load audio (HTTP ${response.status}).`,
            );
          }
          continue;
        }

        setLastError(null);
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);

        await new Promise<void>((resolve, reject) => {
          const audio = new Audio(objectUrl);
          audioRef.current = audio;
          setIsPlaying(true);

          audio.onended = () => {
            URL.revokeObjectURL(objectUrl);
            audioRef.current = null;
            setIsPlaying(false);
            resolve();
          };

          audio.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            audioRef.current = null;
            setIsPlaying(false);
            reject(new Error("Audio playback failed"));
          };

          void audio.play().catch((error: unknown) => {
            setLastError(
              error instanceof Error
                ? error.message
                : "Browser blocked audio playback. Click Replay on a message.",
            );
            reject(error);
          });
        });
      } catch (error) {
        console.error("Failed to play message audio:", error);
        setIsPlaying(false);
      }
    }

    processingRef.current = false;
  }, []);

  const enqueue = useCallback(
    (messageId: string, options?: { replay?: boolean }) => {
      if (!enabledRef.current || mutedRef.current) {
        return;
      }

      if (options?.replay) {
        replayFlagsRef.current.set(messageId, true);
        queueRef.current.unshift(messageId);
      } else {
        queueRef.current.push(messageId);
      }

      void processQueue();
    },
    [processQueue],
  );

  const enableReadAloud = useCallback(async () => {
    await unlockAudioPlayback();
    enabledRef.current = true;
    setEnabled(true);
    setLastError(null);
    void processQueue();
  }, [processQueue]);

  const replayMessage = useCallback(
    async (messageId: string) => {
      await unlockAudioPlayback();
      if (!enabledRef.current) {
        enabledRef.current = true;
        setEnabled(true);
      }
      if (mutedRef.current) {
        setMutedPreference(false);
      }
      enqueue(messageId, { replay: true });
    },
    [enqueue, setMutedPreference],
  );

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  return {
    enabled,
    muted,
    isPlaying,
    lastError,
    enableReadAloud,
    setMuted: setMutedPreference,
    enqueue,
    replayMessage,
  };
}
