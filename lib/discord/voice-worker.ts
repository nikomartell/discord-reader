export type WorkerJoinResult =
  | { ok: true; channelId: string; channelName: string }
  | { ok: false; error: string };

const JOIN_TIMEOUT_MS = 10_000;

function workerHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${process.env.VOICE_WORKER_SECRET}`,
    "Content-Type": "application/json",
  };
}

function getWorkerUrl(): string | null {
  const url = process.env.VOICE_WORKER_URL;
  return url?.replace(/\/$/, "") ?? null;
}

export async function requestWorkerJoin(payload: {
  guildId: string;
  channelId?: string | null;
  userId: string;
}): Promise<WorkerJoinResult> {
  const baseUrl = getWorkerUrl();

  if (!baseUrl) {
    return {
      ok: false,
      error: "Voice service is not configured.",
    };
  }

  try {
    const response = await fetch(`${baseUrl}/events/join`, {
      method: "POST",
      headers: workerHeaders(),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(JOIN_TIMEOUT_MS),
    });

    const data = (await response.json()) as WorkerJoinResult;

    if (!response.ok) {
      return {
        ok: false,
        error: data.ok === false ? data.error : "Could not join voice channel.",
      };
    }

    return data;
  } catch (error) {
    console.error("Voice worker join request failed:", error);
    return {
      ok: false,
      error: "Could not reach voice service. Try again.",
    };
  }
}

export function notifyWorkerMessage(payload: {
  messageId: string;
  guildId: string | null;
}): void {
  if (!payload.guildId) {
    return;
  }

  const baseUrl = getWorkerUrl();
  if (!baseUrl) {
    return;
  }

  void fetch(`${baseUrl}/events/message`, {
    method: "POST",
    headers: workerHeaders(),
    body: JSON.stringify(payload),
  }).catch((error) => {
    console.error("Voice worker message notify failed:", error);
  });
}

export function notifyWorkerLeave(payload: { guildId: string }): void {
  const baseUrl = getWorkerUrl();
  if (!baseUrl) {
    return;
  }

  void fetch(`${baseUrl}/events/leave`, {
    method: "POST",
    headers: workerHeaders(),
    body: JSON.stringify(payload),
  }).catch((error) => {
    console.error("Voice worker leave notify failed:", error);
  });
}
