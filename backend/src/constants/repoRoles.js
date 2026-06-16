/** Roles that repo admin can assign when creating users */
const ASSIGNABLE_REPO_ROLES = [
  "TEAM_LEADER",
  "HEAD_OFFICE_STAFF",
  "OFFICE_STAFF",
];

/** All roles visible under a company user list */
const COMPANY_USER_ROLES = [
  "REPO_ADMIN",
  "TEAM_LEADER",
  "HEAD_OFFICE_STAFF",
  "OFFICE_STAFF",
  "REPO_STAFF",
  "REPO_VIEWER",
];

/** Non-admin company users that repo admin can block / update */
const MANAGEABLE_REPO_ROLES = [
  "TEAM_LEADER",
  "HEAD_OFFICE_STAFF",
  "OFFICE_STAFF",
  "REPO_STAFF",
  "REPO_VIEWER",
];

module.exports = {
  ASSIGNABLE_REPO_ROLES,
  COMPANY_USER_ROLES,
  MANAGEABLE_REPO_ROLES,
};
