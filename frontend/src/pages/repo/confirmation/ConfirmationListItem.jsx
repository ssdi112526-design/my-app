import { formatVehicleNumberDisplay } from "../../../utils/vehicleNumberUtils";
import { getInventoryStatus } from "./confirmationListUtils";

function formatReportedAt(value, compact) {
  if (!value) return "—";
  try {
    const d = new Date(value);
    if (compact) {
      return d.toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return d.toLocaleString();
  } catch {
    return "—";
  }
}

function formatCaseCodeCompact(caseCode) {
  if (!caseCode) return "";
  const code = String(caseCode);
  if (code.length <= 18) return code;
  return `…${code.slice(-14)}`;
}

function getInventoryDisplay(item, compact) {
  const inventory = getInventoryStatus(item);
  if (!compact) return inventory;
  const short = {
    revision: "Update",
    confirmed: "Inv. OK",
    "pending-approval": "Awaiting",
    "pending-upload": "No inv.",
  };
  return {
    ...inventory,
    label: short[inventory.key] || inventory.label,
  };
}

function statusBadge(status) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "PENDING") return "cf-badge cf-badge--pending";
  if (normalized === "CONFIRMED") return "cf-badge cf-badge--confirmed";
  if (normalized === "REJECTED") return "cf-badge cf-badge--rejected";
  return "cf-badge";
}

function actionLabel(item, isRepoAdmin) {
  const status = String(item?.status || "").toUpperCase();
  if (isRepoAdmin) {
    if (status === "PENDING") return "Review";
    if (status === "CONFIRMED") {
      const inv = getInventoryStatus(item);
      if (inv.key === "pending-approval") return "Confirm inventory";
      return "View case";
    }
    return "View case";
  }
  if (status === "CONFIRMED") {
    const inv = getInventoryStatus(item);
    if (inv.key === "pending-upload" || inv.key === "revision") return "Upload inventory";
    return "View inventory";
  }
  return null;
}

export default function ConfirmationListItem({
  item,
  isRepoAdmin,
  onView,
  onInventory,
  compact = false,
}) {
  const status = String(item?.status || "").toUpperCase();
  const isConfirmed = status === "CONFIRMED";
  const isPending = status === "PENDING";
  const needsInventory = !isRepoAdmin && isConfirmed && !item.inventorySubmitted;
  const userCanOpen = !isRepoAdmin && isConfirmed;
  const adminCanOpen = isRepoAdmin && (isPending || isConfirmed);
  const clickable = adminCanOpen || userCanOpen;
  const inventory = getInventoryDisplay(item, compact);
  const action = actionLabel(item, isRepoAdmin);

  const handleOpen = () => {
    if (isRepoAdmin) onView(item);
    else if (userCanOpen) onInventory(item);
  };

  return (
    <article
      className={[
        "cf-mobile-card",
        isPending ? "cf-mobile-card--pending" : "",
        isConfirmed ? "cf-mobile-card--confirmed" : "",
        needsInventory ? "cf-mobile-card--needs-inventory" : "",
        clickable ? "cf-mobile-card--clickable" : "",
        inventory.key === "confirmed" ? "cf-mobile-card--inventory-done" : "",
        compact ? "cf-mobile-card--compact" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={() => {
        if (clickable) handleOpen();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && clickable) handleOpen();
      }}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      <div className={`cf-mobile-card__head${compact ? " cf-mobile-card__head--compact" : ""}`}>
        <div className="cf-mobile-card__title-block">
          <div className="cf-mobile-card__title-row">
            <p className="cf-mobile-card__vehicle">
              {formatVehicleNumberDisplay(item.vehicleNumber) || "—"}
            </p>
            {compact ? (
              <div className="cf-mobile-card__badges cf-mobile-card__badges--inline">
                <span className={statusBadge(item.status)}>{item.status || "—"}</span>
                {isConfirmed ? (
                  <span className={inventory.badgeClass}>{inventory.label}</span>
                ) : null}
              </div>
            ) : null}
          </div>
          {compact ? (
            <>
              <p className="cf-mobile-card__customer cf-mobile-card__customer--compact">
                {item.customerName || "—"}
              </p>
              {item.caseCode ? (
                <p
                  className="cf-mobile-card__case-code cf-mobile-card__case-code--compact"
                  title={item.caseCode}
                >
                  {formatCaseCodeCompact(item.caseCode)}
                </p>
              ) : null}
            </>
          ) : (
            <>
              <p className="cf-mobile-card__customer">{item.customerName || "—"}</p>
              {item.caseCode ? (
                <p className="cf-mobile-card__case-code">Case {item.caseCode}</p>
              ) : null}
            </>
          )}
        </div>
        {!compact ? (
          <div className="cf-mobile-card__badges">
            <span className={statusBadge(item.status)}>{item.status || "—"}</span>
            {isConfirmed ? (
              <span className={inventory.badgeClass}>{inventory.label}</span>
            ) : null}
          </div>
        ) : null}
      </div>

      <dl className={`cf-mobile-card__meta${compact ? " cf-mobile-card__meta--compact" : ""}`}>
        {isRepoAdmin ? (
          <div>
            <dt>Traced by</dt>
            <dd>{item.requestedByName || "—"}</dd>
          </div>
        ) : null}
        {isRepoAdmin ? (
          <div>
            <dt>Mobile</dt>
            <dd>
              {item.requestedByPhone ? (
                <a
                  href={`tel:${item.requestedByPhone}`}
                  className="cf-mobile-card__phone"
                  onClick={(e) => e.stopPropagation()}
                >
                  {item.requestedByPhone}
                </a>
              ) : (
                "—"
              )}
            </dd>
          </div>
        ) : null}
        {isRepoAdmin ? (
          <div>
            <dt>Bank</dt>
            <dd>
              {item.bankName || "—"}
              {item.branchName ? ` / ${item.branchName}` : ""}
            </dd>
          </div>
        ) : null}
        <div>
          <dt>Reported</dt>
          <dd>{formatReportedAt(item.createdAt, compact)}</dd>
        </div>
      </dl>

      {item.requestNote ? (
        <p className={`cf-mobile-card__note${compact ? " cf-mobile-card__note--compact" : ""}`}>
          {item.requestNote}
        </p>
      ) : null}

      {clickable && action ? (
        <div className="cf-mobile-card__foot">
          <button
            type="button"
            className={[
              "cf-mobile-card__btn",
              needsInventory || inventory.key === "revision"
                ? "cf-mobile-card__btn--inv"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={(e) => {
              e.stopPropagation();
              handleOpen();
            }}
          >
            {action}
          </button>
        </div>
      ) : null}
    </article>
  );
}
