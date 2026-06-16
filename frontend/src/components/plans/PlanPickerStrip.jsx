import { Link } from "react-router-dom";
import { SSDI_PLANS } from "../../constants/ssdiPlans";
import { buildPlansUrl } from "../../utils/planNavigation";
import "../../styles/plan-picker.css";

export default function PlanPickerStrip({
  selectedPlanId = "",
  plansBasePath,
  returnTo,
}) {
  return (
    <div className="plan-picker-strip">
      <p className="plan-picker-hint">
        Choose a subscription tier. Click a plan to view details on the plans page.
      </p>
      <div className="plan-picker-chips">
        {SSDI_PLANS.map((plan) => {
          const isSelected = selectedPlanId === plan.id;
          const to = buildPlansUrl(plansBasePath, {
            planId: plan.id,
            returnTo,
          });

          return (
            <Link
              key={plan.id}
              to={to}
              className={`plan-picker-chip plan-picker-chip--${plan.accent}${
                isSelected ? " is-selected" : ""
              }`}
            >
              <span className="plan-picker-chip-name">{plan.name}</span>
              <span className="plan-picker-chip-price">
                {plan.priceLabel} / {plan.priceUnit || "per month"}
              </span>
            </Link>
          );
        })}
      </div>
      <Link
        to={buildPlansUrl(plansBasePath, { returnTo })}
        className="plan-picker-view-all"
      >
        Compare all plans →
      </Link>
    </div>
  );
}
