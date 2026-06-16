import { pollUploadUntilDone } from "./uploadPoll";
import { listenUploadProgress } from "./uploadSocket";
import { emitDashboardRefresh } from "./dashboardEvents";
import { repoCaseService } from "../services/repoCase.service";

/**
 * Wait for upload batch completion using Socket.IO (live) + polling fallback.
 */
export async function waitForUploadBatch(batchId, token, { onProgress } = {}) {
  let resolved = false;
  let rejectFn = null;

  const pollPromise = pollUploadUntilDone(batchId, token, { onProgress }).then(
    (batch) => {
      resolved = true;
      return batch;
    }
  );

  const socketPromise = new Promise((resolve, reject) => {
    rejectFn = reject;
    const cleanup = listenUploadProgress(token, batchId, {
      onProgress: (payload) => {
        if (typeof onProgress === "function") {
          onProgress({
            processedRows: payload.processedRows,
            totalRows: payload.totalRows,
            status: payload.status,
            importNote: payload.message,
          });
        }
      },
      onComplete: (payload) => {
        cleanup();
        if (!resolved) resolve(payload.batch || payload);
      },
      onFailed: (payload) => {
        cleanup();
        if (!resolved) {
          reject(new Error(payload.errorMessage || "Upload failed."));
        }
      },
    });

    setTimeout(() => cleanup(), 4 * 60 * 60 * 1000);
  });

  try {
    const batch = await Promise.race([
      pollPromise,
      socketPromise.then(async (batch) => {
        if (batch && batch.status) return batch;
        return pollUploadUntilDone(batchId, token, { onProgress });
      }),
    ]);

    if (batch?.status === "completed") {
      emitDashboardRefresh({ batchId, batch });
      if (token) {
        repoCaseService.warmSearchCache(token).catch(() => {});
      }
    }

    return batch;
  } catch (err) {
    if (rejectFn) rejectFn(err);
    throw err;
  }
}
