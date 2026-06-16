import { useEffect, useMemo, useState } from "react";
import { FiX } from "react-icons/fi";
import { FaWhatsapp, FaEnvelope, FaSms } from "react-icons/fa";
import useAuth from "../../hooks/useAuth";
import bankService from "../../services/bank.service";
import VehicleNumberPlate from "./VehicleNumberPlate";
import {
  allExcelColumnsForDisplay,
  formatCoreFieldDisplay,
} from "../../utils/bankRecordDisplay";
import {
  getBankerRowsForBankRecord,
  getBankRecordNotifyContacts,
} from "../../utils/bankRecordBankerFields";
import {
  coerceBankerNameDisplay,
  coerceBankerPhoneDisplay,
} from "../../utils/bankerValueUtils";
import {
  filterBankRecordExcelRows,
  filterBankRecordFieldsByRole,
  shouldShowFullBankRecordFields,
} from "../../utils/bankRecordFieldVisibility";
import { openBankRecordShare } from "../../utils/bankRecordNotifyShare";
import "../../styles/bankRecordDetail.css";

const CORE_FIELDS = [
  { key: "vehicleNumber", label: "Vehicle Number", isVehicle: true },
  { key: "borrowerName", label: "Borrower Name" },
  { key: "borrowerPhone", label: "Phone" },
  { key: "loanAccountNumber", label: "Loan Account" },
  { key: "outstandingAmount", label: "Outstanding" },
  { key: "loanAmount", label: "Loan Amount" },
  { key: "chassisNumber", label: "Chassis Number" },
  { key: "engineNumber", label: "Engine Number" },
  { key: "vehicleMake", label: "Vehicle Make" },
  { key: "vehicleModel", label: "Vehicle Model" },
  { key: "vehicleYear", label: "Year" },
  { key: "branchName", label: "Branch" },
  { key: "branchCode", label: "Branch Code" },
  { key: "borrowerAddress", label: "Address", full: true },
];


function fieldValue(record, field) {
  if (field.isVehicle) {
    return <VehicleNumberPlate record={record} size="lg" />;
  }
  return formatCoreFieldDisplay(record, field.key);
}

function formatBankerCell(value, key = "") {
  const t = String(value ?? "").trim();
  if (!t || t.toUpperCase() === "NA" || t.toUpperCase() === "N/A") return "—";
  if (key.endsWith("Phone")) {
    return coerceBankerPhoneDisplay(t) || "—";
  }
  if (key.endsWith("Name")) {
    return coerceBankerNameDisplay(t) || "—";
  }
  return coerceBankerNameDisplay(t) || coerceBankerPhoneDisplay(t) || "—";
}

export default function BankRecordDetailModal({
  recordId,
  fetchMode = "bank",
  onClose,
}) {
  const { auth } = useAuth();
  const role = auth?.user?.role;
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const showFull = shouldShowFullBankRecordFields(role);
  const isRepoAdmin = role === "REPO_ADMIN";
  const isAgencyStaff = fetchMode === "agency" || fetchMode === "assigned";

  useEffect(() => {
    if (!recordId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError("");
      try {
        let res;
        if (fetchMode === "agency" || fetchMode === "assigned") {
          res = await bankService.getAssignedRecord(recordId);
        } else if (fetchMode === "repo") {
          res = await bankService.getLinkedRecord(recordId);
        } else {
          res = await bankService.getRecord(recordId);
        }
        if (!cancelled) {
          setRecord(res?.data?.data?.record || null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.message || "Could not load record");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [recordId, fetchMode]);

  const visibleCoreFields = useMemo(
    () => filterBankRecordFieldsByRole(CORE_FIELDS, role),
    [role]
  );

  const excelColumns = useMemo(() => {
    if (!record) return [];
    return filterBankRecordExcelRows(allExcelColumnsForDisplay(record), role);
  }, [record, role]);

  const bankerRows = useMemo(() => {
    if (!record || !showFull) return [];
    return getBankerRowsForBankRecord(record, excelColumns).map(({ key, label, value }) => ({
      key,
      label,
      value: formatBankerCell(value, key),
    }));
  }, [record, showFull, excelColumns]);

  const notifyContacts = record ? getBankRecordNotifyContacts(record) : {};

  const handleShare = (type, direction) => {
    if (!record) return;
    const contacts =
      direction === "toBanker"
        ? notifyContacts
        : {
            notifyPhone: auth?.user?.phone || "",
            notifyEmail: auth?.user?.email || "",
          };
    openBankRecordShare(type, record, contacts, {
      authUser: auth?.user,
      role,
      direction,
    });
  };

  return (
    <div className="bank-record-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="bank-record-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bank-record-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="bank-record-modal__header">
          <div>
            <h2 id="bank-record-modal-title">Case details</h2>
            {record && (
              <p className="bank-record-modal__subtitle">
                {formatCoreFieldDisplay(record, "borrowerName")}
                {showFull && formatCoreFieldDisplay(record, "loanAccountNumber") !== "—"
                  ? ` · Loan ${formatCoreFieldDisplay(record, "loanAccountNumber")}`
                  : ""}
              </p>
            )}
          </div>
          <button type="button" className="bank-record-modal__close" onClick={onClose} aria-label="Close">
            <FiX />
          </button>
        </header>

        {loading && <p className="muted bank-record-modal__status">Loading…</p>}
        {error && <p className="error-text bank-record-modal__status">{error}</p>}

        {!loading && !error && record && (
          <div className="bank-record-modal__body">
            <div className="bank-record-modal__vehicle-hero">
              <VehicleNumberPlate record={record} size="hero" />
            </div>

            {(isRepoAdmin || isAgencyStaff) && (
              <div className="bank-record-modal__share">
                {isRepoAdmin && (
                  <>
                    <p className="bank-record-modal__hint">Notify banker (WhatsApp / email / SMS):</p>
                    <div className="bank-record-modal__share-btns">
                      <button type="button" className="secondary-page-btn" onClick={() => handleShare("whatsapp", "toBanker")}>
                        <FaWhatsapp /> WhatsApp
                      </button>
                      <button type="button" className="secondary-page-btn" onClick={() => handleShare("email", "toBanker")}>
                        <FaEnvelope /> Email
                      </button>
                      <button type="button" className="secondary-page-btn" onClick={() => handleShare("sms", "toBanker")}>
                        <FaSms /> SMS
                      </button>
                    </div>
                  </>
                )}
                {isAgencyStaff && (
                  <>
                    <p className="bank-record-modal__hint">Send update to your admin:</p>
                    <div className="bank-record-modal__share-btns">
                      <button type="button" className="secondary-page-btn" onClick={() => handleShare("whatsapp", "toAdmin")}>
                        <FaWhatsapp /> WhatsApp
                      </button>
                      <button type="button" className="secondary-page-btn" onClick={() => handleShare("email", "toAdmin")}>
                        <FaEnvelope /> Email
                      </button>
                      <button type="button" className="secondary-page-btn" onClick={() => handleShare("sms", "toAdmin")}>
                        <FaSms /> SMS
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            <section className="bank-record-modal__section">
              <h3>Recovery details</h3>
              <p className="bank-record-modal__hint">
                {showFull
                  ? "Key fields from the bank Excel file."
                  : "Assigned case fields (loan and banker contacts are visible to admin only)."}
              </p>
              <dl className="bank-record-detail-grid">
                {visibleCoreFields.map((field) => (
                  <div
                    key={field.key}
                    className={`bank-record-detail-item${
                      field.full ? " bank-record-detail-item--full" : ""
                    }${field.isVehicle ? " bank-record-detail-item--vehicle" : ""}`}
                  >
                    <dt>{field.label}</dt>
                    <dd>{fieldValue(record, field)}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {showFull && (
              <section className="bank-record-modal__section">
                <h3>Banker contacts (from Excel)</h3>
                <p className="bank-record-modal__hint">
                  1st / 2nd / 3rd banker name and mobile — same columns as your upload sheet.
                </p>
                <dl className="bank-record-detail-grid bank-record-detail-grid--excel">
                  {bankerRows.map(({ key, label, value }) => (
                    <div key={key || label} className="bank-record-detail-item">
                      <dt>{label}</dt>
                      <dd className={value === "—" ? "bank-record-detail-item__empty" : ""}>
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            {excelColumns.length > 0 && (
              <section className="bank-record-modal__section">
                <h3>{showFull ? "All columns from Excel file" : "Additional details"}</h3>
                <dl className="bank-record-detail-grid bank-record-detail-grid--excel">
                  {excelColumns.map(({ label, value }) => (
                    <div key={`${label}-${value}`} className="bank-record-detail-item">
                      <dt>{label}</dt>
                      <dd className={value === "—" ? "bank-record-detail-item__empty" : ""}>
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            <section className="bank-record-modal__section bank-record-modal__meta">
              {showFull && (
                <p>
                  <strong>Bank:</strong>{" "}
                  {record.bankId?.bankName || "—"}
                  {record.bankId?.bankCode ? ` (${record.bankId.bankCode})` : ""}
                </p>
              )}
              {showFull && (
                <p>
                  <strong>Uploaded by:</strong> {record.uploadedBy?.name || "—"}
                  {record.uploadedBy?.email ? ` · ${record.uploadedBy.email}` : ""}
                </p>
              )}
              <p>
                <strong>Status:</strong> {record.status || "active"}
              </p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
