import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { getReturnLabel, getReturnPath } from "../../../utils/navReturn";
import useAuth from "../../../hooks/useAuth";
import confirmationService from "../../../services/confirmation.service";
import ConfirmationExcelList from "./ConfirmationExcelList";
import {
  CONFIRMATION_VIEWS,
  applyConfirmationViewFilter,
  getListEmptyMessage,
  getListSectionTitle,
  matchesConfirmationSearch,
} from "./confirmationListUtils";
import { compareLabels } from "../../../utils/sortByLabel";
import { onDashboardRefresh } from "../../../utils/dashboardEvents";
import "../../../styles/users.css";
import "../../../styles/confirmation.css";

function resolveListFilter(statusParam, isRepoAdmin) {
  const status = String(statusParam || "").toUpperCase();
  if (status === "PENDING" || status === "CONFIRMED" || status === "REJECTED") {
    return status;
  }
  return isRepoAdmin ? "PENDING" : "CONFIRMED";
}

function resolveView(viewParam) {
  const view = String(viewParam || "").toLowerCase();
  if (view === CONFIRMATION_VIEWS.INVENTORY_CONFIRMED) {
    return CONFIRMATION_VIEWS.INVENTORY_CONFIRMED;
  }
  if (view === CONFIRMATION_VIEWS.INVENTORY_PENDING_APPROVAL) {
    return CONFIRMATION_VIEWS.INVENTORY_PENDING_APPROVAL;
  }
  return "";
}

export default function Confirmation() {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isRepoAdmin = auth?.user?.role === "REPO_ADMIN";
  const isFieldUser = !isRepoAdmin;
  const returnTo = getReturnPath(searchParams, location.state);
  const returnLabel = getReturnLabel(returnTo);

  const statusParam = searchParams.get("status") || "";
  const viewParam = searchParams.get("view") || "";
  const listFilter = useMemo(
    () => resolveListFilter(statusParam, isRepoAdmin),
    [statusParam, isRepoAdmin]
  );
  const listView = useMemo(() => resolveView(viewParam), [viewParam]);

  const [confirmations, setConfirmations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const loadSeqRef = useRef(0);

  useEffect(() => {
    const normalized = String(statusParam || "").toUpperCase();
    if (normalized === "PENDING" || normalized === "CONFIRMED" || normalized === "REJECTED") {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.set("status", isRepoAdmin ? "PENDING" : "CONFIRMED");
    const from = searchParams.get("from");
    if (from) next.set("from", from);
    setSearchParams(next, { replace: true });
  }, [statusParam, isRepoAdmin, searchParams, setSearchParams]);

  const loadConfirmations = useCallback(async () => {
    if (!auth?.token) {
      setLoading(false);
      return;
    }

    const seq = ++loadSeqRef.current;

    try {
      setLoading(true);
      setError("");

      const params = { status: listFilter };
      const res = await confirmationService.getAll(auth.token, params);
      if (seq !== loadSeqRef.current) return;

      let items = Array.isArray(res?.data) ? res.data : [];
      items = items.filter(
        (item) => String(item?.status || "").toUpperCase() === listFilter
      );
      items = applyConfirmationViewFilter(items, listView);
      setConfirmations(items);
    } catch (err) {
      if (seq !== loadSeqRef.current) return;
      setError(err?.response?.data?.message || "Failed to load confirmations");
      setConfirmations([]);
    } finally {
      if (seq === loadSeqRef.current) {
        setLoading(false);
      }
    }
  }, [auth?.token, listFilter, listView]);

  useEffect(() => {
    return onDashboardRefresh(loadConfirmations);
  }, [loadConfirmations]);

  useEffect(() => {
    loadConfirmations();
  }, [loadConfirmations]);

  useEffect(() => {
    setSearchQuery("");
  }, [listFilter, listView]);

  const displayedConfirmations = useMemo(() => {
    const filtered = confirmations.filter((item) =>
      matchesConfirmationSearch(item, searchQuery, isRepoAdmin)
    );
    return [...filtered].sort((a, b) => {
      const byVehicle = compareLabels(a?.vehicleNumber, b?.vehicleNumber);
      if (byVehicle !== 0) return byVehicle;
      return compareLabels(a?.customerName, b?.customerName);
    });
  }, [confirmations, searchQuery, isRepoAdmin]);

  const openConfirmation = (item) => {
    if (!isRepoAdmin || !item?._id) return;
    const listReturn = `${location.pathname}${location.search}`;
    navigate(`/confirmation/${item._id}`, { state: { from: listReturn } });
  };

  const openInventory = (item) => {
    if (!item?._id) return;
    navigate(`/inventory-update?confirmationId=${item._id}`);
  };

  const pageTitle = getListSectionTitle(listFilter, listView);
  const baseEmptyMessage = getListEmptyMessage(listFilter, listView, isRepoAdmin);
  const emptyMessage = searchQuery.trim()
    ? `No cases match “${searchQuery.trim()}”.`
    : baseEmptyMessage;

  return (
    <div className={`page cf-page cf-page--list-only${isFieldUser ? " cf-page--user" : ""}`}>
      <div className="cf-view-top">
        <Link to={returnTo} className="cf-view-back">
          ← Back to {returnLabel}
        </Link>
      </div>

      <header className="cf-page__title-row">
        <h2 className="cf-page__title">{pageTitle}</h2>
        {!loading && confirmations.length > 0 ? (
          <p className="cf-list-count" aria-live="polite">
            {displayedConfirmations.length === confirmations.length
              ? `${confirmations.length} case${confirmations.length === 1 ? "" : "s"}`
              : `${displayedConfirmations.length} of ${confirmations.length}`}
          </p>
        ) : null}
      </header>

      {error ? <p className="error-text">{error}</p> : null}

      <section className="cf-table-card card cf-table-card--responsive">
        {!loading ? (
          <label className="cf-list-search">
            <span className="sr-only">Search confirmations</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isRepoAdmin
                  ? "Search vehicle, customer, bank, chassis, loan…"
                  : "Search vehicle, customer, chassis, loan…"
              }
              autoComplete="off"
            />
          </label>
        ) : null}

        {loading ? (
          <p className="cf-excel-loading">Loading…</p>
        ) : displayedConfirmations.length === 0 ? (
          <p className="cf-excel-loading cf-list-empty">{emptyMessage}</p>
        ) : (
          <ConfirmationExcelList
            items={displayedConfirmations}
            isRepoAdmin={isRepoAdmin}
            listFilter={listFilter}
            onView={openConfirmation}
            onInventory={openInventory}
          />
        )}
      </section>
    </div>
  );
}
