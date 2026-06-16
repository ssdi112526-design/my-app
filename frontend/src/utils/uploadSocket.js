import { io } from "socket.io-client";

function resolveSocketUrl() {
  if (process.env.REACT_APP_SOCKET_URL) {
    return process.env.REACT_APP_SOCKET_URL;
  }
  const api = process.env.REACT_APP_API_BASE_URL || "/api";
  if (api.startsWith("http")) {
    return api.replace(/\/api\/?$/, "");
  }
  return undefined;
}

const SOCKET_URL = resolveSocketUrl();

/**
 * Listen for live upload progress via Socket.IO while job runs in BullMQ worker.
 * Returns cleanup function.
 */
export function listenUploadProgress(token, batchId, handlers = {}) {
  if (!token || !batchId) return () => {};

  const socket = io(SOCKET_URL, {
    path: "/socket.io",
    auth: { token },
    transports: ["websocket", "polling"],
  });

  const onProgress = (payload) => {
    if (String(payload?.batchId) !== String(batchId)) return;
    handlers.onProgress?.(payload);
  };

  const onComplete = (payload) => {
    if (String(payload?.batchId) !== String(batchId)) return;
    handlers.onComplete?.(payload);
  };

  const onFailed = (payload) => {
    if (String(payload?.batchId) !== String(batchId)) return;
    handlers.onFailed?.(payload);
  };

  socket.on("upload:progress", onProgress);
  socket.on("upload:complete", onComplete);
  socket.on("upload:failed", onFailed);

  return () => {
    socket.off("upload:progress", onProgress);
    socket.off("upload:complete", onComplete);
    socket.off("upload:failed", onFailed);
    socket.disconnect();
  };
}
