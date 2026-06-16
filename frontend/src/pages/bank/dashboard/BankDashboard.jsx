import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiUpload, FiUsers, FiActivity, FiFileText } from "react-icons/fi";
import useAuth from "../../../hooks/useAuth";
import bankService from "../../../services/bank.service";
import "../../../styles/dashboard.css";

export default function BankDashboard() {
  const { auth } = useAuth();
  const user = auth?.user;
  const isAdmin = user?.role === "BANK_ADMIN";

  const [stats, setStats] = useState({ records: 0, persons: 0, agencies: 0, files: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [recRes, tracRes, uploadRes] = await Promise.all([
          bankService.getRecords({ limit: 1 }),
          bankService.getTracingView(),
          bankService.listUploads(),
        ]);
        const records = recRes?.data?.data?.total || 0;
        const agencies = tracRes?.data?.data?.agencies?.length || 0;
        const files = uploadRes?.data?.data?.batches?.length || 0;

        let persons = 0;
        if (isAdmin) {
          const pRes = await bankService.getPersons();
          persons = pRes?.data?.data?.persons?.length || 0;
        }

        setStats({ records, persons, agencies, files });
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [isAdmin]);

  return (
    <div className="page">
      <div className="dashboard-header">
        <div>
          <h2>Welcome, {user?.name}</h2>
          <p className="muted" style={{ marginTop: 4 }}>
            {user?.bank?.bankName} &nbsp;·&nbsp; {user?.role === "BANK_ADMIN" ? "Bank Admin" : "Bank Person"}
          </p>
        </div>
      </div>

      {loading ? (
        <p className="muted">Loading...</p>
      ) : (
        <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginTop: 24 }}>
          <StatCard label="Total Records" value={stats.records} icon={<FiUpload />} to="/bank/records" />
          <StatCard label="Uploaded Files" value={stats.files} icon={<FiFileText />} to="/bank/files" />
          <StatCard label="Linked Agencies" value={stats.agencies} icon={<FiActivity />} to="/bank/tracing" />
          {isAdmin && <StatCard label="Persons" value={stats.persons} icon={<FiUsers />} to="/bank/persons" />}
        </div>
      )}

      <div style={{ marginTop: 32, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link to="/bank/records" className="primary-page-btn">Upload / View Records</Link>
        <Link to="/bank/tracing" className="secondary-page-btn">View Tracing</Link>
        {isAdmin && <Link to="/bank/persons" className="secondary-page-btn">Manage Persons</Link>}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, to }) {
  return (
    <Link to={to} style={{ textDecoration: "none" }}>
      <div className="stat-card" style={{ background: "var(--card-bg, #fff)", border: "1px solid var(--border, #e5e7eb)", borderRadius: 8, padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ color: "var(--accent, #2563eb)", fontSize: 22 }}>{icon}</span>
        <span style={{ fontSize: 28, fontWeight: 700 }}>{value}</span>
        <span style={{ color: "var(--muted, #6b7280)", fontSize: 14 }}>{label}</span>
      </div>
    </Link>
  );
}
