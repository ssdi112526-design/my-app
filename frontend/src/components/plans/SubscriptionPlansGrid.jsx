import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FiCheck } from "react-icons/fi";
import { SSDI_PLANS } from "../../constants/ssdiPlans";
import { buildPlansUrl } from "../../utils/planNavigation";

function getIncludesLabel(planId) {
  if (planId === "free") return "Includes:";
  if (planId === "silver") return "Everything in Free, plus:";
  if (planId === "golden") return "Everything in Silver, plus:";
  return "Everything in Golden, plus:";
}

function getCtaLabel(plan, returnTo) {
  if (returnTo) return "Select plan";
  return `Get ${plan.name}`;
}

export default function SubscriptionPlansGrid({
  highlightedPlanId = "",
  returnTo = "",
  plansBasePath = "/ssdi/plans",
  onSelectPlan,
}) {
  const navigate = useNavigate();
  const highlightRef = useRef(null);

  useEffect(() => {
    if (!highlightedPlanId || !highlightRef.current) return;
    highlightRef.current.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [highlightedPlanId]);

  const handleCardClick = (plan) => {
    if (returnTo && onSelectPlan) {
      onSelectPlan(plan);
      return;
    }
    navigate(buildPlansUrl(plansBasePath, { planId: plan.id, returnTo }));
  };

  const handleCta = (plan) => {
    if (returnTo && onSelectPlan) {
      onSelectPlan(plan);
      return;
    }
    navigate(buildPlansUrl(plansBasePath, { planId: plan.id, returnTo }));
  };

  return (
    <div className="ssdi-plans-grid">
      {SSDI_PLANS.map((plan) => {
        const isHighlighted = highlightedPlanId === plan.id;
        const cardRef = isHighlighted ? highlightRef : null;

        return (
          <article
            key={plan.id}
            ref={cardRef}
            role="button"
            tabIndex={0}
            className={`ssdi-plan-card${plan.popular ? " is-featured" : ""}${
              isHighlighted ? " is-selected" : ""
            }`}
            data-accent={plan.accent}
            onClick={() => handleCardClick(plan)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleCardClick(plan);
              }
            }}
          >
            {isHighlighted && (
              <span className="ssdi-plan-selected-badge">Selected</span>
            )}

            <div className="ssdi-plan-card-top">
              <h3 className="ssdi-plan-name">{plan.name}</h3>
              <p className="ssdi-plan-price-line">
                <span className="ssdi-plan-price">{plan.priceLabel}</span>
                <span className="ssdi-plan-price-suffix"> / {plan.priceUnit || "per month"}</span>
              </p>
              {plan.billingNote && (
                <p className="ssdi-plan-billing-note">{plan.billingNote}</p>
              )}
              <p className="ssdi-plan-limit-line">{plan.userLimitLabel}</p>
            </div>

            <div className="ssdi-plan-card-body">
              <p className="ssdi-plan-includes">{getIncludesLabel(plan.id)}</p>
              <ul className="ssdi-plan-features">
                {plan.features.map((feature) => (
                  <li key={feature}>
                    <FiCheck className="ssdi-plan-check" aria-hidden />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              type="button"
              className="ssdi-plan-cta primary"
              onClick={(e) => {
                e.stopPropagation();
                handleCta(plan);
              }}
            >
              {getCtaLabel(plan, returnTo)}
            </button>
          </article>
        );
      })}
    </div>
  );
}
