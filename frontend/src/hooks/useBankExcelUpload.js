import { useCallback, useEffect, useRef, useState } from "react";
import bankService from "../services/bank.service";
import { uploadFileToPresignedUrl } from "../utils/s3DirectUpload";

const POLL_INTERVAL = 3000;

/**
 * S3 presign → upload → background processing → poll batch status.
 */
export function useBankExcelUpload({ onComplete } = {}) {
  const [uploadStage, setUploadStage] = useState("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [activeBatch, setActiveBatch] = useState(null);
  const pollRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (batchId) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const res = await bankService.getUploadBatch(batchId);
          const batch = res?.data?.data?.batch;
          if (!batch) return;
          setActiveBatch(batch);
          if (batch.status !== "processing" && batch.status !== "pending") {
            stopPolling();
            setUploadStage("idle");
            onComplete?.(batch);
          }
        } catch {
          /* silent */
        }
      }, POLL_INTERVAL);
    },
    [onComplete, stopPolling]
  );

  useEffect(() => () => stopPolling(), [stopPolling]);

  const uploadFile = async (file) => {
    if (!file) return;
    setUploadError("");
    setActiveBatch(null);

    try {
      setUploadStage("presigning");
      const presignRes = await bankService.presignUpload({
        fileName: file.name,
        contentType:
          file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const { batchId, uploadUrl, contentType } = presignRes?.data?.data || {};
      if (!batchId || !uploadUrl) {
        throw new Error("Server did not return upload URL. Check S3 config.");
      }

      setUploadStage("uploading");
      setUploadProgress(0);
      const mime =
        contentType ||
        file.type ||
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      try {
        await uploadFileToPresignedUrl(file, uploadUrl, (loaded, total) => {
          setUploadProgress(Math.round((loaded / total) * 100));
        }, mime);
      } catch {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("batchId", batchId);
        await bankService.proxyUpload(formData);
      }

      setUploadStage("processing");
      await bankService.completeUpload({ batchId });

      setActiveBatch({ _id: batchId, status: "processing", processedRows: 0, totalRows: 0 });
      startPolling(batchId);
    } catch (err) {
      setUploadStage("idle");
      setUploadError(err?.response?.data?.message || err?.message || "Upload failed");
    }
  };

  const dismissBatch = () => setActiveBatch(null);

  const uploadButtonLabel = () => {
    if (uploadStage === "presigning") return "Preparing…";
    if (uploadStage === "uploading") return `Uploading ${uploadProgress}%`;
    if (uploadStage === "processing") return "Processing…";
    return "Upload Excel";
  };

  return {
    uploadStage,
    uploadProgress,
    uploadError,
    setUploadError,
    activeBatch,
    dismissBatch,
    uploadFile,
    uploadButtonLabel,
    isBusy: uploadStage !== "idle",
  };
}
