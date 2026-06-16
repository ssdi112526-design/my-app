export const LOCATION_PERMISSION_DISMISS_KEY = "repo.locationPermissionDismissed";
export const LOCATION_PERMISSION_GRANTED_KEY = "repo.locationPermissionGranted";

/** “Not now” — only for this browser session so login / next visit can ask again. */
export function isLocationPermissionDismissed() {
  try {
    if (window.localStorage.getItem(LOCATION_PERMISSION_DISMISS_KEY) === "1") {
      window.sessionStorage.setItem(LOCATION_PERMISSION_DISMISS_KEY, "1");
      window.localStorage.removeItem(LOCATION_PERMISSION_DISMISS_KEY);
    }
    return window.sessionStorage.getItem(LOCATION_PERMISSION_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function markLocationPermissionDismissed() {
  try {
    window.sessionStorage.setItem(LOCATION_PERMISSION_DISMISS_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** User allowed location — do not show the prompt again. */
export function markLocationPermissionGranted() {
  try {
    window.localStorage.setItem(LOCATION_PERMISSION_GRANTED_KEY, "1");
    window.sessionStorage.removeItem(LOCATION_PERMISSION_DISMISS_KEY);
  } catch {
    /* ignore */
  }
}

export function isLocationPermissionGranted() {
  try {
    return window.localStorage.getItem(LOCATION_PERMISSION_GRANTED_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearLocationPermissionGranted() {
  try {
    window.localStorage.removeItem(LOCATION_PERMISSION_GRANTED_KEY);
  } catch {
    /* ignore */
  }
}
