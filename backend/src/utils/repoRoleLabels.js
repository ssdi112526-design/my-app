const REPO_ROLE_LABELS = {
  REPO_ADMIN: "Repo Admin",
  TEAM_LEADER: "Team Leader",
  HEAD_OFFICE_STAFF: "Head Office Staff",
  OFFICE_STAFF: "Office Staff",
  REPO_STAFF: "Repo Staff",
  REPO_VIEWER: "Repo Viewer",
};

function formatRepoRole(role) {
  if (!role) return "";
  return REPO_ROLE_LABELS[role] || String(role).replace(/_/g, " ");
}

module.exports = { formatRepoRole };
