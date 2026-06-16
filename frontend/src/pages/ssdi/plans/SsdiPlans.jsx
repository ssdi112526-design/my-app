import { Link, useNavigate, useSearchParams } from "react-router-dom";
import SubscriptionPlansGrid from "../../../components/plans/SubscriptionPlansGrid";
import {
  decodeReturnTo,
  isValidPlanId,
  navigateWithPlanSelection,
} from "../../../utils/planNavigation";
import "../../../styles/plans.css";

export default function SsdiPlans() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const rawPlan = (searchParams.get("plan") || "").toLowerCase();
  const highlightedPlanId = isValidPlanId(rawPlan) ? rawPlan : "";
  const returnTo = decodeReturnTo(searchParams);

  const handleSelectPlan = (plan) => {
    navigateWithPlanSelection(navigate, returnTo, plan.id);
  };

  return (
    <div className="page ssdi-plans-page">
      <header className="ssdi-plans-header">
        <div>
          <h2>Subscription Plans</h2>
          <p className="muted">
            {returnTo
              ? "Click a plan to select it and return to your previous page."
              : "All plans show monthly pricing. Free is ₹0/month plus a one-time fee per connected user; paid tiers are a flat monthly rate."}
          </p>
        </div>
        {returnTo && (
          <Link to={returnTo} className="secondary-page-btn ssdi-plans-back-link">
            ← Back
          </Link>
        )}
      </header>

      <SubscriptionPlansGrid
        highlightedPlanId={highlightedPlanId}
        returnTo={returnTo}
        plansBasePath="/ssdi/plans"
        onSelectPlan={returnTo ? handleSelectPlan : undefined}
      />
    </div>
  );
}
