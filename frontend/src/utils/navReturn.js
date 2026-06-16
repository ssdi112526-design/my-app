/** Default page after repo login (admin + agent). */
export const DEFAULT_LANDING_PATH = "/find-vehicles";

/** Encode parent path for ?from= so back links return to the page that opened this screen. */
export function withReturnPath(path, returnTo) {
  const parent = returnTo || DEFAULT_LANDING_PATH;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}from=${encodeURIComponent(parent)}`;
}

export function getReturnPath(searchParams, locationState, fallback = DEFAULT_LANDING_PATH) {
  const fromQuery = searchParams.get("from");
  if (fromQuery) {
    try {
      return decodeURIComponent(fromQuery);
    } catch {
      return fromQuery;
    }
  }
  if (locationState?.from) return locationState.from;
  return fallback;
}

const RETURN_LABELS = {
  "/home": "Home",
  "/bank-details": "Upload Records",
  "/control-panel": "Control Panel",
  "/find-vehicles": "Find Vehicles",
  "/cases": "Cases",
  "/reports": "Reports",
};

export function getReturnLabel(returnPath) {
  if (!returnPath) return "Home";
  const base = returnPath.split("?")[0];
  if (RETURN_LABELS[base]) return RETURN_LABELS[base];
  if (base.startsWith("/confirmation")) return "Confirmations";
  return "previous page";
}
