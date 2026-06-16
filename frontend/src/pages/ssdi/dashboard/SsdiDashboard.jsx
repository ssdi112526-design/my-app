import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiBriefcase, FiLayers, FiCreditCard, FiUserPlus } from "react-icons/fi";
import useAuth from "../../../hooks/useAuth";
import companyService from "../../../services/company.service";
import planService from "../../../services/plan.service";
import BrandWordmark from "../../../components/brand/BrandWordmark";
import "../../../styles/dashboard.css";
import "../../../styles/brand.css";

export default function SsdiDashboard() {
  const { auth } = useAuth();

  const [stats, setStats] = useState({
    companies: 0,
    plans: 0,
    pending: 0,
    pendingUsers: 0,
  });

  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    if (!auth?.token) return;

    try {
      setLoading(true);

      const [companyRes, planRes] = await Promise.allSettled([
        companyService.getCompanyStats(auth.token),
        planService.getPlans(auth.token),
      ]);

      const companyStats =
        companyRes.status === "fulfilled"
          ? companyRes.value?.data || companyRes.value || {}
          : {};

      const plansData =
        planRes.status === "fulfilled"
          ? planRes.value?.data?.plans || planRes.value?.plans || []
          : [];

      setStats({
        companies: companyStats.total || 0,
        plans: Array.isArray(plansData) ? plansData.length : 0,
        pending: companyStats.pending || 0,
        pendingUsers: companyStats.pendingUsers || 0,
      });
    } catch (error) {
      setStats({
        companies: 0,
        plans: 0,
        pending: 0,
        pendingUsers: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [auth?.token]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const cards = [
    {
      to: "/ssdi/companies",
      icon: <FiBriefcase />,
      title: "Companies",
      desc: "Create and manage repo companies",
    },
    {
      to: "/ssdi/registrations",
      icon: <FiUserPlus />,
      title: "Registrations",
      desc: "Review APK sign-ups, payment & activation",
    },
    {
      to: "/ssdi/plans",
      icon: <FiLayers />,
      title: "Plans",
      desc: "Manage plan pricing and tiers",
    },
    {
      to: "/ssdi/payments",
      icon: <FiCreditCard />,
      title: "Payments",
      desc: "Monitor transactions",
    },
  ];

  return (
    <div className="content">
      <div className="welcome ssdi-dashboard-hero">
        <div className="welcome-left">
          <h2 className="ssdi-dashboard-welcome">
            Welcome to <BrandWordmark className="brand-wordmark--lg" />
          </h2>
          <p className="muted">Manage the full multi-repo agencies platform.</p>
        </div>

        <div className="stats">
          <div className="stat">
            <div className="stat-value">
              {loading ? "..." : stats.companies}
            </div>
            <div className="stat-label">Companies</div>
          </div>

          <div className="stat">
            <div className="stat-value">{loading ? "..." : stats.plans}</div>
            <div className="stat-label">Plans</div>
          </div>

          <div className="stat">
            <div className="stat-value">{loading ? "..." : stats.pending}</div>
            <div className="stat-label">Pending companies</div>
          </div>

          <div className="stat">
            <div className="stat-value">{loading ? "..." : stats.pendingUsers}</div>
            <div className="stat-label">Pending users</div>
          </div>
        </div>
      </div>

      <div className="starter-cards">
        {cards.map((card) => (
          <Link key={card.title} to={card.to} className="dashboard-card-link">
            <div className="card action-card dashboard-action-card">
              <div className="action-icon dashboard-action-icon">
                {card.icon}
              </div>
              <h4>{card.title}</h4>
              <p className="muted small">{card.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
