import { repoCaseService } from "../services/repoCase.service";

const POLL_MS = 2000;

/**
 * Poll upload batch until completed or failed. Calls onProgress(batch) each tick.
 */
export async function pollUploadUntilDone(batchId, token, { onProgress } = {}) {
  const tick = async () => {
    const res = await repoCaseService.getUploadById(batchId, token);
    const batch = res?.data;

    if (typeof onProgress === "function") {
      onProgress(batch);
    }

    if (batch?.status === "completed") {
      return batch;
    }

    if (batch?.status === "failed") {
      throw new Error(batch?.errorMessage || "Upload failed on server.");
    }

    await new Promise((r) => setTimeout(r, POLL_MS));
    return tick();
  };

  return tick();
}
