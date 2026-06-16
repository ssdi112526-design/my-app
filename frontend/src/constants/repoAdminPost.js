/** Repo admin designation shown on profile and ID card. */
export const REPO_ADMIN_POST_OPTIONS = [
  { value: "Proprietor", label: "Proprietor" },
  { value: "Director", label: "Director" },
  { value: "Partner", label: "Partner" },
];

export function formatRepoAdminPost(value) {
  const v = (value || "").trim();
  if (!v) return "—";
  const match = REPO_ADMIN_POST_OPTIONS.find(
    (o) => o.value.toLowerCase() === v.toLowerCase()
  );
  return match?.label || v;
}
