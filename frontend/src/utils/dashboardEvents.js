const DASHBOARD_REFRESH = "app:dashboard-refresh";

export function emitDashboardRefresh(detail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DASHBOARD_REFRESH, { detail }));
}

export function onDashboardRefresh(handler) {
  if (typeof window === "undefined") return () => {};
  const listener = (event) => handler(event.detail);
  window.addEventListener(DASHBOARD_REFRESH, listener);
  return () => window.removeEventListener(DASHBOARD_REFRESH, listener);
}
