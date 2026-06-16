import { useCallback, useEffect, useMemo, useState } from "react";
import { FiSearch } from "react-icons/fi";
import useAuth from "../../../hooks/useAuth";
import feedbackService from "../../../services/feedback.service";
import FeedbackReviewCard from "../../../components/common/FeedbackReviewCard";
import { fileAssetUrl } from "../../../utils/fileAssetUrl";
import "../../../styles/feedback.css";
import "../../../styles/users.css";

function companyInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function groupByCompany(items) {
  const map = new Map();
  for (const item of items) {
    const company = item.companyId || {};
    const key = String(company._id || company.id || "unknown");
    if (!map.has(key)) {
      map.set(key, { company, feedbacks: [] });
    }
    map.get(key).feedbacks.push(item);
  }
  return Array.from(map.values()).sort((a, b) => {
    const nameA = String(a.company?.companyName || "").toLowerCase();
    const nameB = String(b.company?.companyName || "").toLowerCase();
    return nameA.localeCompare(nameB);
  });
}

export default function SsdiFeedbacks() {
  const { auth } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const loadFeedbacks = useCallback(async () => {
    if (!auth?.token) return;
    try {
      setLoading(true);
      setError("");
      const res = await feedbackService.getSsdiAll(auth.token);
      setItems(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load feedbacks");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [auth?.token]);

  useEffect(() => {
    loadFeedbacks();
  }, [loadFeedbacks]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const company = item.companyId || {};
      const user = item.userId || {};
      const haystack = [
        company.companyName,
        company.companyCode,
        user.name,
        user.email,
        user.role,
        item.message,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, searchQuery]);

  const grouped = useMemo(() => groupByCompany(filtered), [filtered]);

  return (
    <div className="page ssdi-feedbacks-page">
      <h2 className="ssdi-feedbacks-page__title">Feedbacks</h2>

      <div className="company-search-panel company-search-panel--simple">
        <div className="company-search-bar">
          <FiSearch className="company-search-icon" aria-hidden />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search agency, user, or message…"
            aria-label="Search feedbacks"
          />
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <p className="muted">Loading feedbacks…</p>
      ) : filtered.length === 0 ? (
        <p className="ssdi-feedbacks-empty">No feedback submitted yet.</p>
      ) : (
        <>
          {grouped.map(({ company, feedbacks }) => {
            const companyId = company?._id || company?.id || "unknown";
            const logoSrc = fileAssetUrl(company?.photoUrl);
            const sorted = [...feedbacks].sort(
              (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
            );

            return (
              <section key={companyId} className="ssdi-feedback-agency">
                <header className="ssdi-feedback-agency__head">
                  {logoSrc ? (
                    <img
                      src={logoSrc}
                      alt=""
                      className="ssdi-feedback-agency__logo"
                    />
                  ) : (
                    <span className="ssdi-feedback-agency__logo ssdi-feedback-agency__logo--initials">
                      {companyInitials(company?.companyName)}
                    </span>
                  )}
                  <div>
                    <h3 className="ssdi-feedback-agency__name">
                      {company?.companyName || "Agency"}
                    </h3>
                    {company?.companyCode ? (
                      <p className="ssdi-feedback-agency__code">
                        {company.companyCode}
                      </p>
                    ) : null}
                  </div>
                </header>

                <div className="ssdi-recent-feedbacks">
                  <h4 className="ssdi-recent-feedbacks__title">Recent Feedbacks</h4>
                  <div className="ssdi-recent-feedbacks__list">
                    {sorted.map((fb) => (
                      <FeedbackReviewCard key={fb._id} feedback={fb} />
                    ))}
                  </div>
                </div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
