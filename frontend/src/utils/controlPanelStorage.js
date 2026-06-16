const STORAGE_KEY = "repo_control_panel_unlocked";
const SESSION_MS = 8 * 60 * 60 * 1000;

export function getControlPanelUnlockState() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { unlocked: false };
    const data = JSON.parse(raw);
    if (!data?.until || Date.now() > data.until) {
      sessionStorage.removeItem(STORAGE_KEY);
      return { unlocked: false };
    }
    return { unlocked: true, until: data.until };
  } catch {
    return { unlocked: false };
  }
}

export function setControlPanelUnlocked() {
  sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ until: Date.now() + SESSION_MS })
  );
}

export function clearControlPanelUnlock() {
  sessionStorage.removeItem(STORAGE_KEY);
}

export const CONTROL_PANEL_SENSITIVE_PATHS = [
  "/plans",
  "/cases",
  "/users",
  "/bank-details",
  "/upload-records",
  "/otps",
  "/blacklist",
  "/finances",
  "/clean-file",
  "/reports",
];

/** Sidebar stays visible on mobile when locked (before Control Panel password). */
export const CONTROL_PANEL_PUBLIC_PATHS = [
  "/home",
  "/find-vehicles",
  "/find-vehicles/results",
  "/control-panel",
  "/profile",
  "/id-card",
  "/confirmation",
  "/feedback",
  "/live-tracking",
  "/details-view",
  "/inventory-update",
];
