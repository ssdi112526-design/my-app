import { repoCaseService } from "../services/repoCase.service";
import { uploadFileToPresignedUrl } from "./s3DirectUpload";

/**
 * Fast upload: browser → S3 (presigned PUT), then server imports in background.
 */
export async function uploadExcelViaS3({
  file,
  bankName,
  branchName,
  columnMapping,
  token,
  onS3Progress,
}) {
  const presign = await repoCaseService.presignS3Upload(
    {
      bankName,
      branchName,
      fileName: file.name,
      contentType: file.type,
    },
    token
  );

  const { batchId, uploadUrl } = presign?.data || {};
  if (!batchId || !uploadUrl) {
    throw new Error("Could not get S3 upload URL.");
  }

  await uploadFileToPresignedUrl(file, uploadUrl, onS3Progress);

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
