import { useCallback, useEffect, useMemo, useState } from "react";
import { FaWhatsapp, FaEnvelope, FaSms } from "react-icons/fa";
import useAuth from "../../../hooks/useAuth";
import { formatVehicleNumberDisplay } from "../../../utils/vehicleNumberUtils";
import {
  filterFieldsByRole,
  shouldShowAdminOnlyCaseFields,
} from "../../../utils/caseFieldVisibility";
import { useEnrichedAdminCase } from "../../../hooks/useEnrichedAdminCase";
import AdminExcelFieldGrid from "../../../components/repo/AdminExcelFieldGrid";
import { repoCaseService } from "../../../services/repoCase.service";
import { isMongoCaseId } from "./findVehiclesHelpers";

const safeValue = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  return value;
};

const formatMoney = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  const num = Number(value);
  if (Number.isNaN(num)) return safeValue(value);
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

const getFullAddress = (item) => {
  const parts = [
    item.addressLine1,
    item.addressLine2,
    item.city,
    item.district,
    item.state,
    item.pincode,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
};

const DETAIL_FIELDS = [
  { key: "vehicleNumber", label: "Vehicle Number" },
  { key: "customerName", label: "Customer Name" },
  { key: "mobileNumber", label: "Mobile Number" },
  { key: "alternateMobileNumber", label: "Alternate Mobile" },
  { key: "loanAccountNumber", label: "Loan Account" },
  { key: "referenceNumber", label: "Reference Number" },
  { key: "caseCode", label: "Case Code" },
  { key: "engineNumber", label: "Engine Number" },
  { key: "chassisNumber", label: "Chassis Number" },
  { key: "vehicleBrand", label: "Brand" },
  { key: "vehicleModel", label: "Model" },
  { key: "vehicleType", label: "Vehicle Type" },
  { key: "bankName", label: "Bank Name" },
  { key: "branchName", label: "Branch Name" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "pincode", label: "Pincode" },
  { key: "emiAmount", label: "EMI Amount", format: formatMoney },
  { key: "dueAmount", label: "Due Amount", format: formatMoney },
  { key: "totalOutstandingAmount", label: "Outstanding", format: formatMoney },
  { key: "bucket", label: "Bucket" },
  { key: "repoStatus", label: "Repo Status" },
  { key: "confirmationStatus", label: "Confirmation" },
];

export default function VehicleDetailModal({
  item,
  onClose,
  onShare,
  shareBusy = false,
  onLoadedSaved,
  className = "",
  overlayClassName = "",
}) {
  const { auth } = useAuth();
  const isRepoAdmin = shouldShowAdminOnlyCaseFields(auth?.user?.role);
  const detailFields = filterFieldsByRole(DETAIL_FIELDS, auth?.user?.role).filter(
    (field) =>
      !isRepoAdmin ||
      !["mobileNumber", "alternateMobileNumber", "loanAccountNumber"].includes(field.key)
  );

  const [loadedDetail, setLoadedDetail] = useState(
    () => item?.loadedDetail || item?.loadedShort || ""
  );
  const [loadedLoading, setLoadedLoading] = useState(false);
  const [loadedSaving, setLoadedSaving] = useState(false);
  const [loadedError, setLoadedError] = useState("");
  const [loadedSavedMsg, setLoadedSavedMsg] = useState("");
  const [loadedDirty, setLoadedDirty] = useState(false);
  const caseIdForEnrich = isMongoCaseId(item?._id || item?.id) ? item._id || item.id : null;
  const { enrichedCase, enriching } = useEnrichedAdminCase(item, {
    token: auth?.token,
    caseId: caseIdForEnrich,
    enabled: isRepoAdmin && Boolean(item) && Boolean(auth?.token),
  });
  const displayItem = isRepoAdmin ? enrichedCase || item : item;

  const fetchLoaded = useCallback(async () => {
    if (!auth?.token || !item) return;
    setLoadedLoading(true);
    setLoadedError("");
    try {
      const res = await repoCaseService.getVehicleLoaded(auth.token, {
        vehicleNumber: item.vehicleNumber || "",
        chassisNumber: item.chassisNumber || "",
        caseId: isMongoCaseId(item._id || item.id) ? item._id || item.id : undefined,
      });
      const data = res?.data || res;
      setLoadedDetail(data?.loadedDetail || data?.loadedShort || "");
      setLoadedDirty(false);
    } catch (err) {
      setLoadedError(
        err?.response?.data?.message || "Could not load vehicle loaded details."
      );
    } finally {
      setLoadedLoading(false);
    }
  }, [auth?.token, item]);

  useEffect(() => {
    if (!item) return;
    setLoadedDetail(item.loadedDetail || item.loadedShort || "");
    setLoadedSavedMsg("");
    setLoadedDirty(false);
    fetchLoaded();
  }, [item, fetchLoaded]);

  const handleSaveLoaded = async () => {
    if (!auth?.token || !item || (!loadedDirty && !loadedSaving)) return;
    setLoadedSaving(true);
    setLoadedError("");
    setLoadedSavedMsg("");
    try {
      const res = await repoCaseService.saveVehicleLoaded(auth.token, {
        vehicleNumber: item.vehicleNumber || "",
        chassisNumber: item.chassisNumber || "",
        caseId: isMongoCaseId(item._id || item.id) ? item._id || item.id : undefined,
        loadedShort: "",
        loadedDetail,
      });
      const data = res?.data || res;
      const patch = {
        loadedShort: "",
        loadedDetail: data?.loadedDetail ?? loadedDetail,
      };
      onLoadedSaved?.(item, patch);
      setLoadedDirty(false);
      setLoadedSavedMsg("Saved");
      setTimeout(() => setLoadedSavedMsg(""), 1500);
    } catch (err) {
      setLoadedError(
        err?.response?.data?.message || "Could not save loaded details."
      );
    } finally {
      setLoadedSaving(false);
    }
  };

  const sortedDetailRows = useMemo(() => {
    if (!displayItem) return [];

    if (isRepoAdmin) return [];

    return [
      ...detailFields.map(({ key, label, format }) => ({
        key,
        label,
        value:
          key === "vehicleNumber"
            ? formatVehicleNumberDisplay(displayItem[key])
            : format
              ? format(displayItem[key])
              : safeValue(displayItem[key]),
      })),
      {
        key: "address",
        label: "Address",
        value: getFullAddress(displayItem),
      },
    ];
  }, [displayItem, detailFields, isRepoAdmin]);

  if (!item || !displayItem) return null;

  const itemWithLoaded = { ...displayItem, loadedShort: "", loadedDetail };

  return (
    <div
      className={`fv-detail-overlay${overlayClassName ? ` ${overlayClassName}` : ""}`}
      role="presentation"
      onClick={onClose}
    >
      <div
        className={`fv-detail-modal${className ? ` ${className}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fv-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="fv-detail-header">
          <div>
            <h2 id="fv-detail-title">
              {formatVehicleNumberDisplay(displayItem.vehicleNumber)}
            </h2>
            <p className="fv-detail-subtitle">{safeValue(displayItem.customerName)}</p>
          </div>
          <button type="button" className="fv-detail-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {isRepoAdmin ? (
          <AdminExcelFieldGrid
            caseData={displayItem}
            enriching={enriching}
            layout="cards"
          />
        ) : (
          <div className="fv-detail-grid">
            {sortedDetailRows.map((row) => (
              <div
                className={`fv-detail-item${row.key === "address" ? " fv-detail-item--full" : ""}`}
                key={row.key}
              >
                <span className="fv-detail-label">{row.label}</span>
                <span className="fv-detail-value">{row.value}</span>
              </div>
            ))}
          </div>
        )}

        <section className="fv-detail-loaded" aria-label="What is loaded">
          {loadedError ? (
            <p className="fv-error fv-detail-loaded__error">{loadedError}</p>
          ) : null}
          <div className="fv-detail-loaded__row">
            <span className="fv-detail-loaded__label">Loaded details</span>
            <input
              type="text"
              className="fv-detail-loaded__input"
              value={loadedDetail}
              onChange={(e) => {
                setLoadedDetail(e.target.value);
                setLoadedDirty(true);
              }}
              onBlur={handleSaveLoaded}
              placeholder="What is loaded"
              maxLength={2000}
              disabled={loadedLoading || loadedSaving}
            />
            <span className="fv-detail-loaded__status" aria-live="polite">
              {loadedSaving ? "…" : loadedSavedMsg || (loadedLoading ? "…" : "")}
            </span>
          </div>
        </section>

        <div className="fv-detail-actions">
          <button
            type="button"
            className="fv-btn fv-btn-whatsapp"
            disabled={shareBusy}
            onClick={() => onShare("whatsapp", itemWithLoaded)}
          >
            <FaWhatsapp />
            <span>{shareBusy ? "Saving…" : "WhatsApp"}</span>
          </button>
          <button
            type="button"
            className="fv-btn fv-btn-email"
            disabled={shareBusy}
            onClick={() => onShare("email", itemWithLoaded)}
          >
            <FaEnvelope />
            <span>{shareBusy ? "Saving…" : "Email"}</span>
          </button>
          <button
            type="button"
            className="fv-btn fv-btn-sms"
            disabled={shareBusy}
            onClick={() => onShare("sms", itemWithLoaded)}
          >
            <FaSms />
            <span>{shareBusy ? "Saving…" : "SMS"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
