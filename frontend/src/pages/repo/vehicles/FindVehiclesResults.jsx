import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import useAuth from "../../../hooks/useAuth";
import { repoCaseService } from "../../../services/repoCase.service";
import confirmationService from "../../../services/confirmation.service";
import VehicleDetailModal from "./VehicleDetailModal";
import VehiclePreviewSheet from "./VehiclePreviewSheet";
import { shouldShowAdminOnlyCaseFields } from "../../../utils/caseFieldVisibility";
import {
  buildNotifyBankApiPayload,
  buildNotifyContextFromCase,
  openBankNotifyShare,
  openTraceReportShare,
  openWhatsAppUrl,
} from "../../../utils/bankNotifyShare";
import { emitDashboardRefresh } from "../../../utils/dashboardEvents";
import {
  formatVehicleNumberDisplay,
  normalizeVehicleNumber,
  sanitizeVehicleInput,
  filterValidVehicleRecords,
  sanitizeChassisInput,
  normalizeChassis,
  VEHICLE_NUMBER_MAX_LENGTH,
} from "../../../utils/vehicleNumberUtils";
import {
  getItems,
  isMongoCaseId,
  MIN_PHONE_SEARCH_DIGITS,
  MIN_SEARCH_CHARS,
  resolveActiveSearch,
  VEHICLE_SEARCH_MAX_CHARS,
  CHASSIS_SEARCH_MAX_CHARS,
  digitsOnly,
  sanitizeVehicleOrPhoneInput,
} from "./findVehiclesHelpers";
import { sortByLabel } from "../../../utils/sortByLabel";
import VehicleChassisSearchBar from "./VehicleChassisSearchBar";
import "../../../styles/vehicles.css";

const SEARCH_PAGE_LIMIT = 500;
/** Keep URL in sync (bookmarks / share) without delaying results. */
const URL_SYNC_DEBOUNCE_MS = 400;
/** Slight delay before hitting the API while the user is still typing. */
const FETCH_DEBOUNCE_MS = 180;

function dedupeByVehicleNumber(items) {
  const seen = new Set();
  return items.filter((item) => {
    const v = item.vehicleNumber;
    if (!v || seen.has(v)) return false;
    seen.add(v);
    return true;
  });
}

function dedupeById(items) {
  const seen = new Set();
  return items.filter((item) => {
    const id = String(item._id || item.id || "");
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function cardPrimaryLabel(item, searchMode) {
  if (searchMode === "chassis") {
    const ch = item.chassisNumber ? String(item.chassisNumber).toUpperCase() : "";
    if (ch) return ch;
  }
  const vn = item.vehicleNumber;
  if (!vn) return "—";
  return normalizeVehicleNumber(vn);
}

function cardSecondaryLabel(item, searchMode) {
  if (searchMode !== "chassis") return null;
  const vn = item.vehicleNumber;
  if (!vn) return null;
  const norm = normalizeVehicleNumber(vn);
  if (norm.length > VEHICLE_NUMBER_MAX_LENGTH) return null;
  return norm;
}

export default function FindVehiclesResults() {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawQ = searchParams.get("q") || "";
  const typeParam = (searchParams.get("type") || "vehicle").toLowerCase();
  const searchMode =
    typeParam === "chassis" ? "chassis" : typeParam === "phone" ? "phone" : "vehicle";

  const query =
    searchMode === "chassis"
      ? normalizeChassis(rawQ)
      : searchMode === "phone"
        ? digitsOnly(rawQ)
        : normalizeVehicleNumber(rawQ);

  const initialQ = searchParams.get("q") || "";
  const initialType = (searchParams.get("type") || "vehicle").toLowerCase();

  const [draftVehicle, setDraftVehicle] = useState(() =>
    initialType === "chassis"
      ? ""
      : initialType === "phone"
        ? digitsOnly(initialQ).slice(0, VEHICLE_SEARCH_MAX_CHARS)
        : sanitizeVehicleInput(initialQ, VEHICLE_SEARCH_MAX_CHARS)
  );
  const [draftChassis, setDraftChassis] = useState(() =>
    initialType === "chassis" ? sanitizeChassisInput(initialQ, CHASSIS_SEARCH_MAX_CHARS) : ""
  );
  const [lastInteraction, setLastInteraction] = useState(() =>
    initialType === "chassis" ? "chassis" : initialType === "phone" ? "vehicle" : "vehicle"
  );

  const [results, setResults] = useState([]);
  const [totalFromApi, setTotalFromApi] = useState(0);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [previewVehicle, setPreviewVehicle] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [shareBusy, setShareBusy] = useState(false);
  const isAdminPreview = shouldShowAdminOnlyCaseFields(auth?.user?.role);

  const reporter = useMemo(
    () => ({
      name: auth?.user?.name || "",
      role: auth?.user?.role || "",
      phone: auth?.user?.phone || "",
    }),
    [auth?.user?.name, auth?.user?.role, auth?.user?.phone]
  );

  useEffect(() => {
    if (searchMode === "chassis") {
      if (rawQ) setDraftChassis(sanitizeChassisInput(rawQ, CHASSIS_SEARCH_MAX_CHARS));
    } else if (searchMode === "phone") {
      if (rawQ) setDraftVehicle(digitsOnly(rawQ).slice(0, VEHICLE_SEARCH_MAX_CHARS));
    } else if (rawQ) {
      setDraftVehicle(sanitizeVehicleInput(rawQ, VEHICLE_SEARCH_MAX_CHARS));
    }
  }, [rawQ, searchMode]);

  const liveResolved = useMemo(
    () => resolveActiveSearch(draftVehicle, draftChassis, lastInteraction),
    [draftVehicle, draftChassis, lastInteraction]
  );

  const draftsBelowMin = useMemo(() => {
    const v = normalizeVehicleNumber(draftVehicle);
    const c = normalizeChassis(draftChassis);
    return v.length < MIN_SEARCH_CHARS && c.length < MIN_SEARCH_CHARS;
  }, [draftVehicle, draftChassis]);

  const fetchFromUrlFallback =
    !liveResolved && draftsBelowMin && query.length >= MIN_SEARCH_CHARS;

  const fetchQuery = useMemo(() => {
    if (liveResolved) {
      if (liveResolved.mode === "chassis") {
        return normalizeChassis(liveResolved.normalized);
      }
      if (liveResolved.mode === "phone") {
        return digitsOnly(liveResolved.normalized);
      }
      return normalizeVehicleNumber(liveResolved.normalized);
    }
    if (fetchFromUrlFallback) return query;
    return "";
  }, [liveResolved, fetchFromUrlFallback, query]);

  const fetchMode = useMemo(() => {
    if (liveResolved) {
      if (liveResolved.mode === "chassis") return "chassis";
      if (liveResolved.mode === "phone") return "phone";
      return "vehicle";
    }
    if (fetchFromUrlFallback) return searchMode;
    return "vehicle";
  }, [liveResolved, fetchFromUrlFallback, searchMode]);

  const shouldSearch = useMemo(() => {
    if (fetchMode === "phone") {
      return fetchQuery.length >= MIN_PHONE_SEARCH_DIGITS;
    }
    return fetchQuery.length >= MIN_SEARCH_CHARS;
  }, [fetchMode, fetchQuery]);

  useEffect(() => {
    const resolved = resolveActiveSearch(draftVehicle, draftChassis, lastInteraction);
    const timer = setTimeout(() => {
      if (!resolved) {
        if (rawQ) {
          navigate("/find-vehicles/results", { replace: true });
        }
        return;
      }
      const t =
        resolved.mode === "chassis"
          ? "chassis"
          : resolved.mode === "phone"
            ? "phone"
            : "vehicle";
      const next = `/find-vehicles/results?q=${encodeURIComponent(resolved.normalized)}&type=${t}`;
      const current = `${window.location.pathname}${window.location.search}`;
      if (current !== next) {
        navigate(next, { replace: true });
      }
    }, URL_SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draftVehicle, draftChassis, lastInteraction, navigate, rawQ]);

  useEffect(() => {
    if (!auth?.token) return;
    repoCaseService.warmSearchCache(auth.token).catch(() => {});
  }, [auth?.token]);

  useEffect(() => {
    if (!auth?.token || !shouldSearch) {
      setResults([]);
      setTotalFromApi(0);
      setSearchError("");
      setLoadingSearch(false);
      return undefined;
    }

    setLoadingSearch(true);
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearchError("");
      try {
        const apiType =
          fetchMode === "chassis"
            ? "chassisNumber"
            : fetchMode === "phone"
              ? "mobileNumber"
              : "vehicleNumber";
        const res = await repoCaseService.getCases(auth.token, {
          search: fetchQuery,
          type: apiType,
          page: 1,
          limit: SEARCH_PAGE_LIMIT,
        });
        if (cancelled) return;
        const rawItems = getItems(res);
        const filtered =
          fetchMode === "chassis"
            ? dedupeById(rawItems)
            : fetchMode === "phone"
              ? dedupeById(rawItems)
              : dedupeByVehicleNumber(filterValidVehicleRecords(rawItems));
        setResults(filtered);
        setTotalFromApi(Number(res?.total) || filtered.length);
      } catch (err) {
        if (!cancelled) {
          setResults([]);
          setTotalFromApi(0);
          setSearchError(
            err?.response?.data?.message || "Search failed. Try again."
          );
        }
      } finally {
        if (!cancelled) setLoadingSearch(false);
      }
    }, FETCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [auth?.token, shouldSearch, fetchQuery, fetchMode]);

  const handleShare = async (channel, item) => {
    if (!auth?.token || shareBusy || !item) return;

    const mongoId = String(item._id || item.id || "");
    const notifyContacts = isAdminPreview
      ? {}
      : {
          notifyPhone: item.mobileNumber || item.alternateMobileNumber || "",
          notifyEmail: item.email || "",
        };
    const notifyContext = buildNotifyContextFromCase(item, auth?.user);

    setShareBusy(true);
    try {
      if (isAdminPreview) {
        await openBankNotifyShare(channel, item, notifyContacts, notifyContext, {
          token: auth.token,
        });
        if (isMongoCaseId(mongoId)) {
          repoCaseService
            .notifyBankTraced(
              mongoId,
              buildNotifyBankApiPayload(channel, auth?.user),
              auth.token
            )
            .catch(() => {});
        }
        return;
      }

      const res = await confirmationService.create(
        {
          ...(isMongoCaseId(mongoId) ? { caseId: mongoId } : {}),
          searchItem: item,
          traceMode: "ONLINE",
          shareChannel: channel,
        },
        auth.token
      );

      if (res?.success === false) {
        throw new Error(res?.message || "Could not save trace.");
      }

      emitDashboardRefresh();

      if (channel === "whatsapp" && res?.traceReport?.whatsAppUrl) {
        openWhatsAppUrl(res.traceReport.whatsAppUrl);
      } else {
        openTraceReportShare(channel, item, reporter);
      }
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        (isAdminPreview
          ? "Could not open share. Try again."
          : "Could not save trace. Admin will not see a pending confirmation.");
      window.alert(msg);
    } finally {
      setShareBusy(false);
    }
  };

  const showQuery = shouldSearch;
  const truncated = showQuery && totalFromApi > SEARCH_PAGE_LIMIT;
  const noMatches =
    showQuery && !loadingSearch && !searchError && results.length === 0;

  const displayTitle = useMemo(() => {
    if (!showQuery) return "";
    if (fetchMode === "chassis") return fetchQuery;
    return formatVehicleNumberDisplay(fetchQuery);
  }, [showQuery, fetchQuery, fetchMode]);

  const sortedResults = useMemo(
    () =>
      sortByLabel(results, (item) => cardPrimaryLabel(item, fetchMode)),
    [results, fetchMode]
  );

  return (
    <div className="page find-vehicles-page fv-find-results-layout">
      {showQuery ? (
        <div className="fv-results-topbar">
          <button
            type="button"
            className="fv-results-topbar__back"
            onClick={() => navigate("/find-vehicles")}
            aria-label="Back"
          >
            ←
          </button>
        </div>
      ) : null}

      <div className="fv-search-card fv-mobile-search-shell">
        <VehicleChassisSearchBar
          draftVehicle={draftVehicle}
          draftChassis={draftChassis}
          onVehicleChange={(value) => {
            setLastInteraction("vehicle");
            setDraftVehicle(sanitizeVehicleOrPhoneInput(value));
          }}
          onChassisChange={(value) => {
            setLastInteraction("chassis");
            setDraftChassis(sanitizeChassisInput(value, CHASSIS_SEARCH_MAX_CHARS));
          }}
          onVehicleFocus={() => setLastInteraction("vehicle")}
          onChassisFocus={() => setLastInteraction("chassis")}
          onClearVehicle={() => setDraftVehicle("")}
          onClearChassis={() => setDraftChassis("")}
        />
      </div>

      {searchError && (
        <p className="fv-error fv-results-minimal-error">{searchError}</p>
      )}

      <div className="fv-results-minimal-body">
        {loadingSearch && (
          <div className="fv-empty-box">
            Searching…
            <p className="muted small" style={{ marginTop: 8 }}>
              First search after login may take up to 1–2 minutes while your upload index
              loads into memory. After that, searches are instant until the server restarts.
            </p>
          </div>
        )}

        {!loadingSearch && showQuery && noMatches && (
          <div className="fv-empty-box">
            No match for <strong>{displayTitle || fetchQuery}</strong> (
            {fetchMode === "chassis" ? "chassis" : "vehicle"}).
          </div>
        )}

        {!loadingSearch && showQuery && sortedResults.length > 0 && (
          <>
            {truncated && (
              <p className="fv-results-minimal-truncated">
                Showing first {SEARCH_PAGE_LIMIT} of {totalFromApi} matches.
              </p>
            )}
            <div className="fv-excel-grid" aria-label="Search results">
              {sortedResults.map((item) => {
                const sub = cardSecondaryLabel(item, fetchMode);
                return (
                  <button
                    type="button"
                    key={item._id || item.id}
                    className="fv-excel-grid__cell"
                    onClick={() => {
                      if (isAdminPreview) {
                        setPreviewVehicle(item);
                        setSelectedVehicle(item);
                      } else {
                        setSelectedVehicle(item);
                      }
                    }}
                    title="View details"
                  >
                    <div className="fv-excel-grid__cell-main">
                      <span className="fv-excel-grid__cell-text">
                        {cardPrimaryLabel(item, fetchMode)}
                      </span>
                      <span className="fv-excel-grid__cell-chev" aria-hidden>
                        ›
                      </span>
                    </div>
                    {sub ? <div className="fv-excel-grid__cell-sub">{sub}</div> : null}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {selectedVehicle && (
        <VehicleDetailModal
          item={selectedVehicle}
          overlayClassName={
            isAdminPreview && previewVehicle ? "fv-detail-overlay--bank-strip" : ""
          }
          className={isAdminPreview && previewVehicle ? "fv-detail-modal--bank-strip-open" : ""}
          onClose={() => {
            setSelectedVehicle(null);
            setPreviewVehicle(null);
          }}
          onShare={handleShare}
          shareBusy={shareBusy}
          onLoadedSaved={(vehicleItem, patch) => {
            const id = vehicleItem._id || vehicleItem.id;
            setSelectedVehicle((prev) => (prev ? { ...prev, ...patch } : prev));
            setPreviewVehicle((prev) =>
              prev && (prev._id || prev.id) === id ? { ...prev, ...patch } : prev
            );
            setResults((prev) =>
              prev.map((row) =>
                (row._id || row.id) === id ? { ...row, ...patch } : row
              )
            );
          }}
        />
      )}

      {isAdminPreview && previewVehicle && (
        <VehiclePreviewSheet
          item={previewVehicle}
          onClose={() => setPreviewVehicle(null)}
        />
      )}
    </div>
  );
}
