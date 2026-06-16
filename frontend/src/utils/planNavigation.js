export function buildPlansUrl(basePath, { planId, returnTo } = {}) {
  const params = new URLSearchParams();
  if (planId) params.set("plan", planId);
  if (returnTo) params.set("returnTo", encodeURIComponent(returnTo));
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function matchPlanFromKey(plans, planKey) {
  if (!planKey || !Array.isArray(plans)) return null;
  const key = String(planKey).toLowerCase();
  return (
    plans.find((p) => p.tierId?.toLowerCase() === key) ||
    plans.find((p) => p.name?.toLowerCase() === key) ||
    plans.find((p) => p.code?.toLowerCase() === key) ||
    plans.find((p) => String(p._id) === planKey)
  );
}

export function isValidPlanId(planId) {
  return ["free", "silver", "golden", "platinum"].includes(planId);
}

/** Navigate back to the originating page with the chosen plan applied. */
export function navigateWithPlanSelection(navigate, returnTo, planId) {
  if (!returnTo || !planId) return;
  const separator = returnTo.includes("?") ? "&" : "?";
  navigate(`${returnTo}${separator}plan=${planId}`, {
    state: { selectedPlanId: planId },
  });
}

export function decodeReturnTo(searchParams) {
  const raw = searchParams.get("returnTo") || "";
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
