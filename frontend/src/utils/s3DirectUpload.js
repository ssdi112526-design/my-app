/**
 * PUT file to S3 presigned URL with upload progress.
 */
export function uploadFileToPresignedUrl(file, uploadUrl, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && typeof onProgress === "function") {
        onProgress(event.loaded, event.total);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(
        new Error(
          `S3 upload failed (${xhr.status}). Add CORS on bucket — see backend/docs/S3_CORS.md`
        )
      );
    });

    xhr.addEventListener("error", () => {
      reject(
        new Error(
          "S3 upload network error. Check bucket CORS (backend/docs/S3_CORS.md)."
        )
      );
    });

    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader(
      "Content-Type",
      file.type ||
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    xhr.send(file);
  });
}
