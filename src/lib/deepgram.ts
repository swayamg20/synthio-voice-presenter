import { DeepgramClient } from "@deepgram/sdk";

type DeepgramLiveMessage = {
  type?: string;
  is_final?: boolean;
  speech_final?: boolean;
  channel?: {
    alternatives?: Array<{
      transcript?: string;
    }>;
  };
};

type DeepgramLiveSocket = {
  readyState: number;
  on: (
    event: "open" | "message" | "close" | "error",
    callback:
      | (() => void)
      | ((message: DeepgramLiveMessage) => void)
      | ((event: CloseEvent) => void)
      | ((error: Error) => void),
  ) => void;
  connect: () => DeepgramLiveSocket;
  close: () => void;
  waitForOpen: () => Promise<unknown>;
  sendMedia: (message: ArrayBuffer | Blob | ArrayBufferView) => void;
  sendKeepAlive: (message: { type: "KeepAlive" }) => void;
  sendCloseStream: (message: { type: "CloseStream" }) => void;
};

const RECONNECT_DELAY_MS = 2000;
const MEDIA_RECORDER_TIMESLICE_MS = 250;
const KEEP_ALIVE_INTERVAL_MS = 8000;
const SOCKET_OPEN = 1;

function chooseMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") {
    return undefined;
  }

  return [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
  ].find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
}

function isLikelyAccessToken(token: string): boolean {
  return token.split(".").length === 3;
}

function createClient(token: string): DeepgramClient {
  return isLikelyAccessToken(token)
    ? new DeepgramClient({ accessToken: token })
    : new DeepgramClient({ apiKey: token });
}

function getTranscript(message: DeepgramLiveMessage): string {
  return message.channel?.alternatives?.[0]?.transcript?.trim() ?? "";
}

export function createDeepgramConnection(
  token: string,
  onInterimTranscript: (text: string) => void,
  onFinalTranscript: (text: string) => void,
  onError: (error: Error) => void,
): { start: (stream: MediaStream) => void; stop: () => void } {
  let activeStream: MediaStream | null = null;
  let socket: DeepgramLiveSocket | null = null;
  let mediaRecorder: MediaRecorder | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  let stopped = true;
  let didReconnect = false;
  let connectionGeneration = 0;

  function clearReconnectTimer() {
    if (!reconnectTimer) {
      return;
    }

    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  function clearKeepAliveTimer() {
    if (!keepAliveTimer) {
      return;
    }

    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }

  function stopRecorder() {
    const recorder = mediaRecorder;
    mediaRecorder = null;

    if (!recorder || recorder.state === "inactive") {
      return;
    }

    try {
      recorder.stop();
    } catch {
      // MediaRecorder may already be stopping after a stream/device change.
    }
  }

  function closeSocket() {
    const liveSocket = socket;
    socket = null;

    if (!liveSocket) {
      return;
    }

    try {
      if (liveSocket.readyState === SOCKET_OPEN) {
        liveSocket.sendCloseStream({ type: "CloseStream" });
      }
    } catch {
      // The socket may have already moved out of OPEN while handling an error.
    }

    try {
      liveSocket.close();
    } catch {
      // Closing is best-effort; the connection may already be gone.
    }
  }

  function cleanupConnection() {
    clearKeepAliveTimer();
    stopRecorder();
    closeSocket();
  }

  function reportOrReconnect(error: Error) {
    if (stopped) {
      return;
    }

    cleanupConnection();

    if (!didReconnect && activeStream) {
      didReconnect = true;
      clearReconnectTimer();
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        void connect(activeStream);
      }, RECONNECT_DELAY_MS);
      return;
    }

    onError(error);
  }

  function startRecorder(stream: MediaStream) {
    const mimeType = chooseMimeType();
    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined,
    );

    recorder.ondataavailable = (event) => {
      if (!event.data.size || !socket || socket.readyState !== SOCKET_OPEN) {
        return;
      }

      try {
        socket.sendMedia(event.data);
      } catch (error) {
        reportOrReconnect(
          error instanceof Error
            ? error
            : new Error("Failed to send microphone audio to Deepgram."),
        );
      }
    };

    recorder.onerror = (event) => {
      const recorderError = event as Event & { error?: DOMException };
      reportOrReconnect(
        new Error(recorderError.error?.message || "Microphone recorder failed."),
      );
    };

    recorder.start(MEDIA_RECORDER_TIMESLICE_MS);
    mediaRecorder = recorder;
  }

  function attachSocketHandlers(liveSocket: DeepgramLiveSocket) {
    liveSocket.on("message", ((message: DeepgramLiveMessage) => {
      if (message.type === "UtteranceEnd") {
        return;
      }

      if (message.type !== "Results") {
        return;
      }

      const transcript = getTranscript(message);

      if (!transcript) {
        return;
      }

      if (message.is_final) {
        console.log(`[Deepgram] Final transcript: "${transcript}"`);
        onFinalTranscript(transcript);
        return;
      }

      console.log(`[Deepgram] Interim transcript: "${transcript}"`);
      onInterimTranscript(transcript);
    }) as (message: DeepgramLiveMessage) => void);

    liveSocket.on("close", ((event: CloseEvent) => {
      if (!stopped && event.code !== 1000) {
        reportOrReconnect(
          new Error(
            event.reason || `Deepgram connection closed with code ${event.code}.`,
          ),
        );
      }
    }) as (event: CloseEvent) => void);

    liveSocket.on("error", ((error: Error) => {
      reportOrReconnect(error);
    }) as (error: Error) => void);
  }

  async function connect(stream: MediaStream | null) {
    if (!stream || stopped) {
      return;
    }

    const generation = (connectionGeneration += 1);
    cleanupConnection();

    try {
      const client = createClient(token);
      const liveSocket = (await client.listen.v1.connect({
        Authorization: token,
        model: "nova-2",
        language: "en",
        smart_format: "true",
        endpointing: 1500,
        interim_results: "true",
        utterance_end_ms: 3000,
        reconnectAttempts: 0,
      })) as DeepgramLiveSocket;

      if (stopped || generation !== connectionGeneration) {
        liveSocket.close();
        return;
      }

      socket = liveSocket;
      attachSocketHandlers(liveSocket);
      liveSocket.connect();
      await liveSocket.waitForOpen();

      if (stopped || generation !== connectionGeneration) {
        liveSocket.close();
        return;
      }

      startRecorder(stream);
      clearKeepAliveTimer();
      keepAliveTimer = setInterval(() => {
        try {
          if (socket?.readyState === SOCKET_OPEN) {
            socket.sendKeepAlive({ type: "KeepAlive" });
          }
        } catch {
          // The next websocket error/close event will drive reconnect handling.
        }
      }, KEEP_ALIVE_INTERVAL_MS);
    } catch (error) {
      reportOrReconnect(
        error instanceof Error
          ? error
          : new Error("Failed to connect to Deepgram."),
      );
    }
  }

  return {
    start(stream: MediaStream) {
      stopped = false;
      didReconnect = false;
      activeStream = stream;
      clearReconnectTimer();
      void connect(stream);
    },
    stop() {
      stopped = true;
      connectionGeneration += 1;
      clearReconnectTimer();
      cleanupConnection();
    },
  };
}
