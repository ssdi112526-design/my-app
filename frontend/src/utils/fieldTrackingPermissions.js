import { ROLES } from "./permissions";

/** Roles that share live GPS with admin / team leader maps while using the app. */
export const LIVE_LOCATION_ROLES = [
  ROLES.REPO_STAFF,
  ROLES.TEAM_LEADER,
  ROLES.HEAD_OFFICE_STAFF,
  ROLES.OFFICE_STAFF,
];

export function shouldPromptForLocation(role) {
  return LIVE_LOCATION_ROLES.includes(role);
}

export function shouldShareLiveLocation(role) {
  return LIVE_LOCATION_ROLES.includes(role);
}

/** Case Live Tracking GPS (per case). */
export function canSendFieldGps(role) {
  return role === ROLES.REPO_STAFF || role === ROLES.TEAM_LEADER;
}

export function canViewFleetMap(role) {
  return role === ROLES.REPO_ADMIN || role === ROLES.TEAM_LEADER;
}
