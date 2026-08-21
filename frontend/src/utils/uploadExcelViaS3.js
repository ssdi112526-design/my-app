import { repoCaseService } from "../services/repoCase.service";
import { uploadFileToPresignedUrl } from "./s3DirectUpload";

async function proxyThroughApi(file, batchId, token) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("batchId", batchId);
  const res = await repoCaseService.proxyS3Upload(formData, token);
  if (res?.success === false) {
    throw new Error(res.message || "Server S3 upload failed");
  }
}

/**
 * Fast upload: browser → S3 (presigned PUT), then server imports in background.
 * If the browser PUT is blocked (CORS / checksum), Node uploads the same file.
 */
export async function uploadExcelViaS3({
  file,
  bankName,
  branchName,
  columnMapping,
  token,
  onS3Progress,
}) {
  const signedContentType =
    file.type ||
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  const presign = await repoCaseService.presignS3Upload(
    {
      bankName,
      branchName,
      fileName: file.name,
      contentType: signedContentType,
    },
    token
  );

  const { batchId, uploadUrl, contentType } = presign?.data || {};
  if (!batchId || !uploadUrl) {
    throw new Error("Could not get S3 upload URL.");
  }

  try {
    await uploadFileToPresignedUrl(
      file,
      uploadUrl,
      onS3Progress,
      contentType || signedContentType
    );
  } catch {
    await proxyThroughApi(file, batchId, token);
  }

  const complete = await repoCaseService.completeS3Upload(
    {
      batchId,
      bankName,
      branchName,
      columnMapping: columnMapping ? JSON.stringify(columnMapping) : undefined,
    },
    token
  );

  return { batchId, response: complete };
}
