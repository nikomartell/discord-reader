"use client";

import { useEffect, useMemo, useState } from "react";

import type { MessageItem } from "@/lib/messages";

type MessageFeedProps = {
  initialMessages: MessageItem[];
};

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function MessageFeed({ initialMessages }: MessageFeedProps) {
  const [messages, setMessages] = useState<MessageItem[]>(initialMessages);
  const [connectionState, setConnectionState] = useState<
    "connecting" | "live" | "reconnecting"
  >("connecting");

  const messageIds = useMemo(
    () => new Set(messages.map((message) => message.id)),
    [messages],
  );

  useEffect(() => {
    let source: EventSource | null = null;
    let reconnectDelay = 1000;
    let cancelled = false;

    const connect = () => {
      if (cancelled) {
        return;
      }

      setConnectionState((current) =>
        current === "connecting" ? "connecting" : "reconnecting",
      );

      source = new EventSource("/api/messages/stream");

      source.onopen = () => {
        reconnectDelay = 1000;
        setConnectionState("live");
      };

      source.onmessage = (event) => {
        const message = JSON.parse(event.data) as MessageItem;

        setMessages((current) => {
          if (current.some((entry) => entry.id === message.id)) {
            return current;
          }

          return [message, ...current];
        });
      };

      source.onerror = () => {
        source?.close();
        setConnectionState("reconnecting");

        if (!cancelled) {
          window.setTimeout(connect, reconnectDelay);
          reconnectDelay = Math.min(reconnectDelay * 2, 30000);
        }
      };
    };

    connect();

    return () => {
      cancelled = true;
      source?.close();
    };
  }, []);

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-2 border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
          Discord Reader
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Public Message Feed
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Messages posted from Discord with{" "}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs dark:bg-zinc-900">
            /post
          </code>{" "}
          appear here in near real time.
        </p>
        <p className="text-xs text-zinc-500">
          Status:{" "}
          <span
            className={
              connectionState === "live"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-amber-600 dark:text-amber-400"
            }
          >
            {connectionState === "live"
              ? "Live"
              : connectionState === "connecting"
                ? "Connecting"
                : "Reconnecting"}
          </span>
        </p>
      </header>

      {messages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 px-6 py-16 text-center dark:border-zinc-700">
          <p className="text-lg font-medium text-zinc-800 dark:text-zinc-200">
            No messages yet
          </p>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Run <code className="font-mono">/post message:&quot;Hello&quot;</code>{" "}
            in Discord to publish the first entry.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {messages.map((message) => (
            <li
              key={message.id}
              className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="mb-3 flex items-center justify-between gap-4">
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {message.authorName}
                </p>
                <time
                  className="text-xs text-zinc-500"
                  dateTime={message.createdAt}
                >
                  {formatTimestamp(message.createdAt)}
                </time>
              </div>
              <p className="whitespace-pre-wrap break-words text-zinc-700 dark:text-zinc-300">
                {message.content}
              </p>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-zinc-500">
        Showing {messageIds.size} message{messageIds.size === 1 ? "" : "s"}.
      </p>
    </section>
  );
}
