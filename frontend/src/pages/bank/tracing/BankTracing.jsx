import { useEffect, useState } from "react";
import { FiActivity, FiUser, FiChevronDown, FiChevronUp } from "react-icons/fi";
import bankService from "../../../services/bank.service";

export default function BankTracing() {
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    bankService.getTracingView()
      .then((res) => setAgencies(res?.data?.data?.agencies || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = (idx) => setExpanded((p) => ({ ...p, [idx]: !p[idx] }));

  return (
    <div className="page">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <FiActivity size={22} />
        <h2>Tracing — Who is using my data?</h2>
      </div>

      {loading ? (
        <p className="muted">Loading...</p>
      ) : agencies.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center", color: "var(--muted,#6b7280)" }}>
          <FiActivity size={40} style={{ opacity: 0.3 }} />
          <p style={{ marginTop: 12 }}>No agencies linked to your data yet.</p>
          <p style={{ fontSize: 13 }}>SSDI will connect agencies to your account.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {agencies.map((agency, idx) => {
            const ra = agency.repoAdmin || {};
            const open = expanded[idx];
            return (
              <div key={idx} style={{ background: "var(--card-bg,#fff)", border: "1px solid var(--border,#e5e7eb)", borderRadius: 8, overflow: "hidden" }}>
                <button
                  onClick={() => toggle(idx)}
                  style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                >
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 15 }}>{ra.name || ra.email || "Agency"}</p>
                    <p style={{ color: "var(--muted,#6b7280)", fontSize: 13, marginTop: 2 }}>
                      {ra.email} &nbsp;·&nbsp; {ra.phone || "—"}
                    </p>
                    <p style={{ fontSize: 12, marginTop: 4, color: "var(--muted,#6b7280)" }}>
                      {agency.recordCount} record{agency.recordCount !== 1 ? "s" : ""} assigned
                      &nbsp;·&nbsp; {agency.tracers?.length || 0} tracer{agency.tracers?.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  {open ? <FiChevronUp /> : <FiChevronDown />}
                </button>

                {open && (
                  <div style={{ borderTop: "1px solid var(--border,#e5e7eb)", padding: "16px 20px" }}>
                    {agency.banker && (
                      <p style={{ fontSize: 12, color: "var(--muted,#6b7280)", marginBottom: 12 }}>
                        Referred by: <strong>{agency.banker.name || agency.banker.email}</strong>
                      </p>
                    )}

                    {!agency.tracers?.length ? (
                      <p className="muted" style={{ fontSize: 13 }}>No tracers assigned yet.</p>
                    ) : (
                      <div>
                        <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Tracers working this data:</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {agency.tracers.map((t) => (
                            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--bg,#f9fafb)", borderRadius: 6 }}>
                              <FiUser size={16} />
                              <div>
                                <p style={{ fontWeight: 500, fontSize: 13 }}>{t.name}</p>
                                <p style={{ fontSize: 12, color: "var(--muted,#6b7280)" }}>{t.email} &nbsp;·&nbsp; {t.role}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
