export async function getApiErrorMessage(error, fallback = "Request failed") {
  const data = error?.response?.data;

  if (data instanceof Blob) {
    try {
      const text = await data.text();
      const parsed = JSON.parse(text);
      return parsed?.message || fallback;
    } catch {
      return fallback;
    }
  }

  return data?.message || error?.message || fallback;
}

export async function saveExcelBlob(response, fallbackName = "export.xlsx") {
  const contentType = response.headers?.["content-type"] || "";

  if (contentType.includes("application/json")) {
    const message = await getApiErrorMessage(
      { response },
      "Failed to download Excel file"
    );
    throw new Error(message);
  }

  const disposition = response.headers?.["content-disposition"];
  let filename = fallbackName;

  if (disposition) {
    const match = /filename="?([^";\n]+)"?/i.exec(disposition);
    if (match?.[1]) {
      filename = match[1].trim();
    }
  }

  const blob = new Blob([response.data], {
    type:
      response.headers?.["content-type"] ||
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
