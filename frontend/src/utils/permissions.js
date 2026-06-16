export const ROLES = {
  SSDI_SUPER_ADMIN: "SSDI_SUPER_ADMIN",
  REPO_ADMIN: "REPO_ADMIN",
  TEAM_LEADER: "TEAM_LEADER",
  HEAD_OFFICE_STAFF: "HEAD_OFFICE_STAFF",
  OFFICE_STAFF: "OFFICE_STAFF",
  REPO_STAFF: "REPO_STAFF",
  REPO_VIEWER: "REPO_VIEWER",
};

export const isSsdiAdmin = (role) => role === ROLES.SSDI_SUPER_ADMIN;

export const isRepoAdmin = (role) => role === ROLES.REPO_ADMIN;

export const isRepoAgent = (role) =>
  [
    ROLES.TEAM_LEADER,
    ROLES.HEAD_OFFICE_STAFF,
    ROLES.OFFICE_STAFF,
    ROLES.REPO_STAFF,
    ROLES.REPO_VIEWER,
  ].includes(role);

export const isRepoUser = (role) =>
  [
    ROLES.REPO_ADMIN,
    ROLES.TEAM_LEADER,
    ROLES.HEAD_OFFICE_STAFF,
    ROLES.OFFICE_STAFF,
    ROLES.REPO_STAFF,
    ROLES.REPO_VIEWER,
  ].includes(role);