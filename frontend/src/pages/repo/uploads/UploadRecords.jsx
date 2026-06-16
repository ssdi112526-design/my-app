import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import useAuth from "../../../hooks/useAuth";
import { companyBankService } from "../../../services/companyBank.service";
import ExcelUploadSection from "./ExcelUploadSection";
import SingleEntrySection from "./SingleEntrySection";
import "../../../styles/uploadRecords.css";

export default function UploadRecords() {
  const { auth } = useAuth();
  const [searchParams] = useSearchParams();
  const initialBankId = searchParams.get("bankId") || "";
  const initialBranchName = searchParams.get("branch") || "";

  const [activeTab, setActiveTab] = useState("excel");
  const [banks, setBanks] = useState([]);
  const [banksLoading, setBanksLoading] = useState(true);

  const loadBanks = useCallback(async () => {
    if (!auth?.token) {
      setBanksLoading(false);
      return;
    }

    try {
      setBanksLoading(true);
      const res = await companyBankService.getBanks(auth.token);
      const items = res?.data || [];
      setBanks(Array.isArray(items) ? items : []);
    } catch {
      setBanks([]);
    } finally {
      setBanksLoading(false);
    }
  }, [auth?.token]);

  useEffect(() => {
    loadBanks();
  }, [loadBanks]);

  return (
    <div className="ur-page">
      <div className="ur-header">
        <h1>Upload Records</h1>
        <div className="ur-sub">
          Banks and branches are managed on{" "}
          <Link to="/bank-details">Bank Details</Link>. Choose the same bank and branch here to attach
          uploads to that branch.
        </div>

        {initialBankId && (
          <p className="ur-from-bank-link">
            Pre-filled from <Link to="/bank-details">Bank Details</Link>
            {initialBranchName ? ` — branch “${initialBranchName}”` : ""}.
          </p>
        )}
      </div>

      {banksLoading && banks.length === 0 ? (
        <p className="ur-muted">Loading banks…</p>
      ) : banks.length === 0 ? (
        <p className="ur-note">
          Add at least one bank and branch on the{" "}
          <Link to="/bank-details">Bank Details</Link> page before uploading records.
        </p>
      ) : null}

      <div className="ur-tabs">
        <button
          className={`ur-tab-btn ${activeTab === "excel" ? "active" : ""}`}
          type="button"
          onClick={() => setActiveTab("excel")}
        >
          Excel Upload
        </button>
        <button
          className={`ur-tab-btn ${activeTab === "single" ? "active" : ""}`}
          type="button"
          onClick={() => setActiveTab("single")}
        >
          Single Entry
        </button>
      </div>

      {activeTab === "excel" ? (
        <ExcelUploadSection
          token={auth?.token}
          banks={banks}
          onBanksReload={loadBanks}
          hideBankDetailsForm
          initialBankId={initialBankId}
          initialBranchName={initialBranchName}
        />
      ) : (
        <SingleEntrySection
          token={auth?.token}
          banks={banks}
          initialBankId={initialBankId}
          initialBranchName={initialBranchName}
        />
      )}
    </div>
  );
}
