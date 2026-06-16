/** User-facing message for failed API calls (login, etc.). */
export function getApiErrorMessage(err, fallback = "Request failed") {
  const data = err?.response?.data;
  if (typeof data === "string" && data.trim()) return data;
  if (data?.message) return data.message;

  const status = err?.response?.status;
  if (status === 503 || status === 504 || err?.code === "ECONNABORTED") {
    return (
      "Cannot reach the API server. Start the backend on port 5001 " +
      "(npm run dev in the backend folder). If it still fails, add your IP to " +
      "MongoDB Atlas → Network Access, then restart the backend."
    );
  }
  if (err?.message === "Network Error" || err?.code === "ERR_NETWORK") {
    return (
      "Network error — the backend is not running or not reachable at localhost:5001."
    );
  }

  return err?.message || fallback;
}
