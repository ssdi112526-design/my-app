const { createRedisSubscriber, getRedisClient, isRedisConfigured } = require("../config/redis");
const { SOCKET_CHANNEL } = require("../queues/queue.constants");
const { emitToCompany, emitToUser } = require("../socket");

let subscriber = null;

function publishUploadEvent(event) {
  if (!isRedisConfigured()) return;

  const client = getRedisClient();
  if (!client) return;

  client.publish(SOCKET_CHANNEL, JSON.stringify(event)).catch((err) => {
    console.error("socketBridge publish failed:", err.message);
  });
}

function initSocketBridge() {
  if (!isRedisConfigured()) return;

  subscriber = createRedisSubscriber();
  if (!subscriber) return;

  subscriber.subscribe(SOCKET_CHANNEL, (err) => {
    if (err) {
      console.error("socketBridge subscribe failed:", err.message);
      return;
    }
    console.log("📡 Socket bridge listening on Redis channel:", SOCKET_CHANNEL);
  });

  subscriber.on("message", (_channel, message) => {
    try {
      const event = JSON.parse(message);
      const { companyId, userId, type, payload } = event;

      if (companyId) {
        emitToCompany(companyId, type, payload);
      }
      if (userId) {
        emitToUser(userId, type, payload);
      }
    } catch (err) {
      console.error("socketBridge message parse error:", err.message);
    }
  });
}

function emitUploadProgress({
  companyId,
  userId,
  batchId,
  processedRows,
  totalRows,
  status,
  message,
  percent,
}) {
  publishUploadEvent({
    companyId,
    userId,
    type: "upload:progress",
    payload: {
      batchId,
      processedRows,
      totalRows,
      status,
      message,
      percent,
    },
  });
}

function emitUploadComplete({ companyId, userId, batchId, batch }) {
  publishUploadEvent({
    companyId,
    userId,
    type: "upload:complete",
    payload: { batchId, batch },
  });
}

function emitUploadFailed({ companyId, userId, batchId, errorMessage }) {
  publishUploadEvent({
    companyId,
    userId,
    type: "upload:failed",
    payload: { batchId, errorMessage },
  });
}

module.exports = {
  initSocketBridge,
  publishUploadEvent,
  emitUploadProgress,
  emitUploadComplete,
  emitUploadFailed,
};
