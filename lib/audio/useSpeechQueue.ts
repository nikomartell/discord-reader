"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MUTE_STORAGE_KEY = "discord-reader-read-aloud-muted";

export function useSpeechQueue() {
  const [enabled, setEnabled] = useState(false);
  const [muted, setMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const queueRef = useRef<string[]>([]);
  const processingRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setMuted(window.localStorage.getItem(MUTE_STORAGE_KEY) === "true");
  }, []);

  const setMutedPreference = useCallback((value: boolean) => {
    setMuted(value);
    window.localStorage.setItem(MUTE_STORAGE_KEY, String(value));
  }, []);

  const processQueue = useCallback(async () => {
    if (processingRef.current || !enabled || muted) {
      return;
    }

    processingRef.current = true;

    while (queueRef.current.length > 0 && enabled && !muted) {
      const messageId = queueRef.current.shift();
      if (!messageId) {
        continue;
      }

      try {
        const response = await fetch(`/api/tts/${messageId}`);
        if (!response.ok) {
          continue;
        }

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

          void audio.play().catch(reject);
        });
      } catch (error) {
        console.error("Failed to play message audio:", error);
        setIsPlaying(false);
      }
    }

    processingRef.current = false;
  }, [enabled, muted]);

  const enqueue = useCallback(
    (messageId: string) => {
      if (!enabled || muted) {
        return;
      }

      queueRef.current.push(messageId);
      void processQueue();
    },
    [enabled, muted, processQueue],
  );

  const enableReadAloud = useCallback(() => {
    setEnabled(true);
  }, []);

  useEffect(() => {
    if (enabled && !muted) {
      void processQueue();
    }
  }, [enabled, muted, processQueue]);

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
    enableReadAloud,
    setMuted: setMutedPreference,
    enqueue,
  };
}
