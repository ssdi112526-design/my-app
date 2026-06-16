/** Roles repo admin can pick when creating a user (3 roles only). */
export const REPO_ROLE_OPTIONS = [
  { value: "TEAM_LEADER", label: "Team Leader" },
  { value: "HEAD_OFFICE_STAFF", label: "Head Office Staff" },
  { value: "OFFICE_STAFF", label: "Office Staff" },
];

export const REPO_ROLE_LABELS = {
  TEAM_LEADER: "Team Leader",
  HEAD_OFFICE_STAFF: "Head Office Staff",
  OFFICE_STAFF: "Office Staff",
  REPO_ADMIN: "Repo Admin",
  REPO_STAFF: "Repo Staff",
  REPO_VIEWER: "Repo Viewer",
  SSDI_SUPER_ADMIN: "Super Admin Panel",
};

export function formatRepoRole(role) {
  if (!role) return "-";
  return REPO_ROLE_LABELS[role] || role.replace(/_/g, " ");
}

export function isManageableRepoUser(role) {
  return (
    role &&
    role !== "REPO_ADMIN" &&
    ["TEAM_LEADER", "HEAD_OFFICE_STAFF", "OFFICE_STAFF", "REPO_STAFF", "REPO_VIEWER"].includes(
      role
    )
  );
}
