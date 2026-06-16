import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FiLink, FiTrash2, FiRefreshCw } from "react-icons/fi";
import bankService from "../../../services/bank.service";
import companyService from "../../../services/company.service";
import { getStoredAuth } from "../../../utils/storage";
import StatusBadge from "../../../components/common/StatusBadge";
import "../../../styles/users.css";

const STATUS_COLORS = {
  active: "success",
  pending_payment: "warning",
  expired: "danger",
  inactive: "neutral",
};

export default function SsdiBankDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [bank, setBank] = useState(null);
  const [persons, setPersons] = useState([]);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusNote, setStatusNote] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  const [linkBankPersonId, setLinkBankPersonId] = useState("");
  const [repoAdminList, setRepoAdminList] = useState([]);
  const [selectedRepoAdmin, setSelectedRepoAdmin] = useState("");
  const [linkError, setLinkError] = useState("");
  const [linkSaving, setLinkSaving] = useState(false);

  const [inviteBankPersonId, setInviteBankPersonId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteAgencyName, setInviteAgencyName] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviteSaving, setInviteSaving] = useState(false);

  const reload = async () => {
    const token = getStoredAuth()?.token || "";
    try {
      const [bankRes, companiesRes] = await Promise.all([
        bankService.ssdiGetBank(id),
        companyService.getCompanies(token, { limit: 200, status: "ACTIVE" }),
      ]);
      const data = bankRes?.data?.data;
      setBank(data?.bank);
      setPersons(data?.persons || []);
      setLinks(data?.links || []);
      setSelectedStatus(data?.bank?.status || "");
      const companies =
        companiesRes?.data?.data?.items ||
        companiesRes?.data?.data?.companies ||
        companiesRes?.data?.items ||
        [];
      setRepoAdminList(
        companies
          .map((c) => ({
            id: c.repoAdminUserId?._id || c.repoAdminUserId || null,
            label: `${c.companyName} (${c.companyCode})`,
          }))
          .filter((c) => c.id)
      );
    } catch {/* silent */}
  };

  useEffect(() => {
    const token = getStoredAuth()?.token || "";

    // Run both requests in parallel — no waiting on each other
    Promise.all([
      bankService.ssdiGetBank(id),
      companyService.getCompanies(token, { limit: 200, status: "ACTIVE" }),
    ])
      .then(([bankRes, companiesRes]) => {
        const data = bankRes?.data?.data;
        setBank(data?.bank);
        setPersons(data?.persons || []);
        setLinks(data?.links || []);
        setSelectedStatus(data?.bank?.status || "");

        const companies =
          companiesRes?.data?.data?.items ||
          companiesRes?.data?.data?.companies ||
          companiesRes?.data?.items ||
          [];
        setRepoAdminList(
          companies
            .map((c) => ({
              id: c.repoAdminUserId?._id || c.repoAdminUserId || null,
              label: `${c.companyName} (${c.companyCode})`,
            }))
            .filter((c) => c.id)
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const handleStatusUpdate = async () => {
    setStatusUpdating(true);
    try {
      await bankService.ssdiUpdateStatus(id, {
        status: selectedStatus,
        paymentNote: statusNote,
      });
      await reload();
      setStatusNote("");
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to update status");
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleRenew = async () => {
    if (!window.confirm("Mark payment received and renew for 1 month?")) return;
    try {
      await bankService.ssdiRenewBank(id, { note: "Manual renewal by SSDI" });
      await reload();
    } catch (err) {
      alert(err?.response?.data?.message || "Renewal failed");
    }
  };

  const handleCreateLink = async () => {
    setLinkError("");
    if (!linkBankPersonId) {
      setLinkError("Select a banker");
      return;
    }
    if (!selectedRepoAdmin) {
      setLinkError("Select a repo admin");
      return;
    }
    setLinkSaving(true);
    try {
      await bankService.ssdiCreateLink({
        bankPersonId: linkBankPersonId,
        repoAdminId: selectedRepoAdmin,
      });
      await reload();
      setLinkBankPersonId("");
      setSelectedRepoAdmin("");
    } catch (err) {
      setLinkError(err?.response?.data?.message || "Failed to create link");
    } finally {
      setLinkSaving(false);
    }
  };

  const handleDeleteLink = async (linkId) => {
    if (!window.confirm("Remove this link?")) return;
    try {
      await bankService.ssdiDeleteLink(linkId);
      await reload();
    } catch {
      /* silent */
    }
  };

  const handleCreateInvite = async () => {
    setInviteError("");
    if (!inviteBankPersonId) {
      setInviteError("Select a banker");
      return;
    }
    setInviteSaving(true);
    try {
      const res = await bankService.ssdiCreateInvite({
        bankPersonId: inviteBankPersonId,
        agencyEmail: inviteEmail,
        agencyName: inviteAgencyName,
      });
      setInviteUrl(res?.data?.data?.inviteUrl || "");
    } catch (err) {
      setInviteError(err?.response?.data?.message || "Failed to create invite");
    } finally {
      setInviteSaving(false);
    }
  };

  const handleCopyInvite = () => {
    if (inviteUrl) navigator.clipboard.writeText(inviteUrl);
  };

  if (loading) {
    return (
      <div className="page create-company-page ssdi-bank-details-page">
        <p className="muted">Loading...</p>
      </div>
    );
  }

  if (!bank) {
    return (
      <div className="page create-company-page ssdi-bank-details-page">
        <p>Bank not found.</p>
      </div>
    );
  }

  const allBankers = [
    ...(bank.adminUserId
      ? [
          {
            _id: bank.adminUserId._id || bank.adminUserId,
            name: `${bank.adminUserId.name || "Admin"} (Admin)`,
            email: bank.adminUserId.email,
          },
        ]
      : []),
    ...persons.map((p) => ({ _id: p._id, name: p.name, email: p.email })),
  ];

  return (
    <div className="page create-company-page repo-form-page ssdi-bank-details-page">
      <div className="create-company-header ssdi-bank-details-header">
        <div className="ssdi-bank-details-header__text">
          <h2>{bank.bankName}</h2>
          <p className="muted ssdi-bank-details-subtitle">
            <span className="ssdi-bank-details-code">{bank.bankCode}</span>
            <span className="ssdi-bank-details-sep" aria-hidden>
              ·
            </span>
            <span className="ssdi-bank-details-email">{bank.email}</span>
          </p>
        </div>
        <button
          type="button"
          className="secondary-page-btn"
          onClick={() => navigate("/ssdi/banks")}
        >
          Back to Banks
        </button>
      </div>

      <div className="ssdi-bank-details-stack">
        <section className="create-company-card ssdi-bank-details-card">
          <header className="create-company-section__head">
            <h3>Bank details</h3>
          </header>
          <div className="form-grid two-column ssdi-bank-details-info-grid">
            <div>
              <span className="ssdi-bank-details-stat__label">GST</span>
              <p className="ssdi-bank-details-stat__value">{bank.gstNumber || "—"}</p>
            </div>
            <div>
              <span className="ssdi-bank-details-stat__label">PAN</span>
              <p className="ssdi-bank-details-stat__value">{bank.panNumber || "—"}</p>
            </div>
            <div>
              <span className="ssdi-bank-details-stat__label">Branch</span>
              <p className="ssdi-bank-details-stat__value">{bank.branchName || "—"}</p>
            </div>
            <div>
              <span className="ssdi-bank-details-stat__label">Phone</span>
              <p className="ssdi-bank-details-stat__value">{bank.phone || "—"}</p>
            </div>
            {bank.adminUserId && (
              <>
                <div>
                  <span className="ssdi-bank-details-stat__label">Admin branch</span>
                  <p className="ssdi-bank-details-stat__value">
                    {bank.adminUserId.branchName || bank.branchName || "—"}
                  </p>
                </div>
                <div>
                  <span className="ssdi-bank-details-stat__label">Admin employee #</span>
                  <p className="ssdi-bank-details-stat__value">
                    {bank.adminUserId.employeeNumber || "—"}
                  </p>
                </div>
              </>
            )}
          </div>
        </section>

        <section className="create-company-card ssdi-bank-details-card">
          <header className="create-company-section__head">
            <h3>Status &amp; Payment</h3>
          </header>

          <div className="ssdi-bank-details-stats">
            <div className="ssdi-bank-details-stat">
              <span className="ssdi-bank-details-stat__label">Current Status</span>
              <StatusBadge
                status={bank.status}
                variant={STATUS_COLORS[bank.status]}
              />
            </div>
            <div className="ssdi-bank-details-stat">
              <span className="ssdi-bank-details-stat__label">Next Due</span>
              <span className="ssdi-bank-details-stat__value">
                {bank.nextDueAt
                  ? new Date(bank.nextDueAt).toLocaleDateString("en-IN")
                  : "—"}
              </span>
            </div>
            <div className="ssdi-bank-details-stat">
              <span className="ssdi-bank-details-stat__label">Last Payment</span>
              <span className="ssdi-bank-details-stat__value">
                {bank.lastPaymentAt
                  ? new Date(bank.lastPaymentAt).toLocaleDateString("en-IN")
                  : "—"}
              </span>
            </div>
          </div>

          <div className="form-grid two-column ssdi-bank-details-status-form">
            <div className="form-group">
              <label htmlFor="bankStatusSelect">Change Status</label>
              <select
                id="bankStatusSelect"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="pending_payment">Pending Payment</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="bankStatusNote">Note (optional)</label>
              <input
                id="bankStatusNote"
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                placeholder="Payment note..."
              />
            </div>
          </div>

          <div className="ssdi-bank-details-actions-row">
            <button
              type="button"
              className="primary-page-btn"
              onClick={handleStatusUpdate}
              disabled={statusUpdating}
            >
              {statusUpdating ? "Saving..." : "Update Status"}
            </button>
            <button
              type="button"
              className="secondary-page-btn"
              onClick={handleRenew}
              title="Mark payment and renew for 1 month"
            >
              <FiRefreshCw aria-hidden />
              Renew 1 Month
            </button>
          </div>
        </section>

        <section className="create-company-card ssdi-bank-details-card">
          <header className="create-company-section__head">
            <h3>Persons in this bank</h3>
          </header>
          {persons.length === 0 ? (
            <p className="muted">No persons added by bank admin yet.</p>
          ) : (
            <ul className="ssdi-bank-details-list">
              {persons.map((p) => (
                <li key={p._id} className="ssdi-bank-details-list-item">
                  <div className="ssdi-bank-details-list-item__main">
                    <p className="ssdi-bank-details-list-item__title">{p.name}</p>
                    <p className="muted ssdi-bank-details-list-item__meta">
                      {p.email} · {p.phone}
                      {(p.branchName || p.employeeNumber) && (
                        <>
                          <br />
                          {p.branchName ? `Branch: ${p.branchName}` : ""}
                          {p.branchName && p.employeeNumber ? " · " : ""}
                          {p.employeeNumber ? `Emp# ${p.employeeNumber}` : ""}
                        </>
                      )}
                    </p>
                  </div>
                  <span
                    className={`ssdi-bank-details-pill ${
                      p.isActive
                        ? "ssdi-bank-details-pill--active"
                        : "ssdi-bank-details-pill--inactive"
                    }`}
                  >
                    {p.isActive ? "Active" : "Inactive"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="create-company-card ssdi-bank-details-card">
          <header className="create-company-section__head">
            <h3>Link Banker → Agency (Repo Admin)</h3>
          </header>

          <div className="form-grid two-column ssdi-bank-details-inline-form">
            <div className="form-group">
              <label htmlFor="linkBankPerson">Banker</label>
              <select
                id="linkBankPerson"
                value={linkBankPersonId}
                onChange={(e) => setLinkBankPersonId(e.target.value)}
              >
                <option value="">Select banker</option>
                {allBankers.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name} — {b.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="linkRepoAdmin">Agency / Repo Admin</label>
              <select
                id="linkRepoAdmin"
                value={selectedRepoAdmin}
                onChange={(e) => setSelectedRepoAdmin(e.target.value)}
              >
                <option value="">Select agency</option>
                {repoAdminList.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group full-width ssdi-bank-details-form-submit">
              <button
                type="button"
                className="primary-page-btn"
                onClick={handleCreateLink}
                disabled={linkSaving}
              >
                <FiLink aria-hidden />
                {linkSaving ? "Linking..." : "Create Link"}
              </button>
            </div>
          </div>
          {linkError && <p className="error-text ssdi-bank-details-error">{linkError}</p>}

          {links.length > 0 && (
            <div className="ssdi-bank-details-links">
              <p className="ssdi-bank-details-links__title">Existing links</p>
              <ul className="ssdi-bank-details-list">
                {links.map((l) => (
                  <li key={l._id} className="ssdi-bank-details-list-item">
                    <p className="ssdi-bank-details-list-item__title ssdi-bank-details-link-text">
                      <strong>{l.bankPersonId?.name || "Banker"}</strong>
                      {" → "}
                      {l.repoAdminId?.name || "Agency"} ({l.repoAdminId?.email})
                    </p>
                    <button
                      type="button"
                      className="secondary-page-btn ssdi-bank-details-list-item__btn"
                      onClick={() => handleDeleteLink(l._id)}
                    >
                      <FiTrash2 aria-hidden />
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="create-company-card ssdi-bank-details-card ssdi-bank-details-card--last">
          <header className="create-company-section__head">
            <h3>Create Invite (Agency not yet registered)</h3>
          </header>

          <div className="form-grid two-column ssdi-bank-details-inline-form">
            <div className="form-group">
              <label htmlFor="inviteBankPerson">Banker</label>
              <select
                id="inviteBankPerson"
                value={inviteBankPersonId}
                onChange={(e) => setInviteBankPersonId(e.target.value)}
              >
                <option value="">Select banker</option>
                {allBankers.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name} — {b.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="inviteEmail">Agency Email (optional)</label>
              <input
                id="inviteEmail"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="agency@email.com"
              />
            </div>
            <div className="form-group">
              <label htmlFor="inviteAgencyName">Agency Name (optional)</label>
              <input
                id="inviteAgencyName"
                value={inviteAgencyName}
                onChange={(e) => setInviteAgencyName(e.target.value)}
                placeholder="Agency name"
              />
            </div>
            <div className="form-group full-width ssdi-bank-details-form-submit">
              <button
                type="button"
                className="primary-page-btn"
                onClick={handleCreateInvite}
                disabled={inviteSaving}
              >
                {inviteSaving ? "Creating..." : "Generate Invite Link"}
              </button>
            </div>
          </div>
          {inviteError && (
            <p className="error-text ssdi-bank-details-error">{inviteError}</p>
          )}
          {inviteUrl && (
            <div className="ssdi-bank-details-invite-box">
              <p className="ssdi-bank-details-invite-box__title">
                Invite link generated
              </p>
              <code className="ssdi-bank-details-invite-box__url">{inviteUrl}</code>
              <button
                type="button"
                className="secondary-page-btn"
                onClick={handleCopyInvite}
              >
                Copy Link
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
