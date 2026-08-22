export const AUTH_STORAGE_KEY = "ssdi_repo_crm_auth";
export const AUTH_EXPIRED_EVENT = "fr-auth-expired";

export function setStoredAuth(data) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
}

export function getStoredAuth() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error("Failed to parse stored auth:", error);
    return null;
  }
}

export function decodeJwtPayload(token) {
  try {
    const payload = String(token || "").split(".")[1];
    if (!payload) return null;
    const padded = payload.replace(/-/g, "+").replace(/_/g, "/");
    const pad = "=".repeat((4 - (padded.length % 4)) % 4);
    return JSON.parse(atob(padded + pad));
  } catch {
    return null;
  }
}

export function isAccessTokenExpired(token, skewMs = 10_000) {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return false;
  return payload.exp * 1000 <= Date.now() + skewMs;
}

/** Stored session only if token + user exist and JWT is not expired. */
export function getValidStoredAuth() {
  const saved = getStoredAuth();
  if (!saved?.token || !saved?.user) return null;
  if (isAccessTokenExpired(saved.token)) {
    clearStoredAuth();
    return null;
  }
  return saved;
}

export function clearStoredAuth() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function emitAuthExpired() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
}