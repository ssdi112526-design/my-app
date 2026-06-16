import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { FiSearch } from "react-icons/fi";
import useAuth from "../../../hooks/useAuth";
import { companyBankService } from "../../../services/companyBank.service";
import "../../../styles/users.css";
import "../../../styles/confirmation.css";
import "../../../styles/finances.css";

export default function Finances() {
  const { auth } = useAuth();
  const isRepoAdmin = auth?.user?.role === "REPO_ADMIN";

  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return [...banks]
      .map((bank) => ({
        key: bank._id,
        bankName: bank.bankName || "—",
      }))
      .filter((row) => {
        if (!query) return true;
        return String(row.bankName).toLowerCase().includes(query);
      })
      .sort((a, b) => String(a.bankName).localeCompare(String(b.bankName)));
  }, [banks, search]);

  const loadBanks = useCallback(async () => {
    if (!auth?.token) return;

    try {
      setLoading(true);
      setError("");
      const res = await companyBankService.getBanks(auth.token);
      const items = res?.data || [];
      setBanks(Array.isArray(items) ? items : []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load connected banks");
      setBanks([]);
    } finally {
      setLoading(false);
    }
  }, [auth?.token]);

  useEffect(() => {
    loadBanks();
  }, [loadBanks]);

  if (!isRepoAdmin) {
    return <Navigate to="/home" replace />;
  }

  return (
    <div className="page finances-page cf-page">
      <header className="finances-head">
        <h2>Partner Banks</h2>
        {!loading && rows.length > 0 && (
          <div className="finances-stats" aria-label="Bank summary">
            <span className="finances-stat">
              <strong>{rows.length}</strong> bank{rows.length === 1 ? "" : "s"}
            </span>
          </div>
        )}
      </header>

      <div className="finances-search">
        <FiSearch className="finances-search__icon" aria-hidden />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search bank…"
          aria-label="Search banks"
        />
      </div>

      <div className="company-table-wrap cf-excel-sheet finances-sheet">
        {error ? <p className="error-text">{error}</p> : null}

        {loading ? (
          <p className="cf-excel-loading">Loading banks…</p>
        ) : rows.length === 0 ? (
          <p className="cf-excel-loading">
            {search.trim()
              ? "No banks match your search."
              : "No banks connected yet. Add banks under Upload Records."}
          </p>
        ) : (
          <div className="table-scroll">
            <table className="users-table excel-grid-table cf-excel-list-table finances-table">
              <thead>
                <tr>
                  <th>S.No.</th>
                  <th>Bank Name</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.key} className="finances-row">
                    <td>{index + 1}</td>
                    <td className="finances-bank-name">{row.bankName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
