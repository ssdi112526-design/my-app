/** Login categories shown in the public header dropdown (Tata-style). */
export const LOGIN_PORTAL_OPTIONS = [
  {
    id: "ssdi",
    label: "Platform Admin",
    description: "SSDI platform owner",
    route: "/ssdi/login",
  },
  {
    id: "repo-admin",
    label: "Repo Company Admin",
    description: "Recovery agency admin",
    route: "/repo-admin/login",
  },
  {
    id: "repo-agent",
    label: "Repo Field Agent",
    description: "Tracer / field staff",
    route: "/repo-agent/login",
  },
  {
    id: "bank",
    label: "Bank / Financer",
    description: "Bank admin & bank users",
    route: "/bank/login",
  },
  {
    id: "register",
    label: "Register",
    description: "New company or agent",
    route: "/register",
  },
];

export function getLoginPortalByRoute(pathname) {
  return LOGIN_PORTAL_OPTIONS.find((p) => p.route === pathname);
}
