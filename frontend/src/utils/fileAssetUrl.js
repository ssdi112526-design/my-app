/** Resolve `/uploads/...` paths to full backend URL for images. */
export function fileAssetUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const api = process.env.REACT_APP_API_BASE_URL || "/api";
  const base = process.env.REACT_APP_BACKEND_URL
    ? process.env.REACT_APP_BACKEND_URL.replace(/\/$/, "")
    : api.startsWith("http")
      ? api.replace(/\/api\/?$/, "")
      : "";
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Download a DOM node as PNG using print (fallback) or canvas. */
export async function downloadNodeAsPng(node, filename = "id-card.png") {
  if (!node) return;

  try {
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(node, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
    });
    const link = document.createElement("a");
    link.download = filename;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } catch {
    window.print();
  }
}
