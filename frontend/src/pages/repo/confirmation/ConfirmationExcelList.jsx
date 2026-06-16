import { formatVehicleNumberDisplay } from "../../../utils/vehicleNumberUtils";
import { getInventoryStatus } from "./confirmationListUtils";
import {
  actionLabel,
  buildMobileExcelRows,
  formatReportedAt,
  isRowClickable,
  rowClassName,
  showInventoryColumn,
  statusBadgeClass,
} from "./confirmationExcelListHelpers";

function InventoryBadge({ item }) {
  const inv = getInventoryStatus(item);
  if (inv.key === "na") return "—";
  return <span className={inv.badgeClass}>{inv.label}</span>;
}

function ConfirmationMobileExcelCard({ item, isRepoAdmin, showInventoryCol, onActivate }) {
  const clickable = isRowClickable(item, isRepoAdmin);
  const label = actionLabel(item, isRepoAdmin);
  const rows = buildMobileExcelRows(item, { isRepoAdmin, showInventoryCol });

  return (
    <article
      className={`cf-excel-list-mobile-item ${rowClassName(item, isRepoAdmin)}`}
      onClick={() => {
        if (clickable) onActivate(item);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && clickable) onActivate(item);
      }}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      <div className="cf-excel-mobile-stack">
        {rows.map((row, index) => (
          <div key={`${row.label}-${index}`} className="cf-excel-mobile-row">
            <span className="cf-excel-mobile-row__label">{row.label}</span>
            <span className="cf-excel-mobile-row__value">
              {row.isStatus ? (
                <span className={statusBadgeClass(item.status)}>{row.value}</span>
              ) : row.inventory ? (
                <span className={row.inventory.badgeClass}>{row.value}</span>
              ) : (
                row.value
              )}
            </span>
          </div>
        ))}
      </div>
      {clickable && label !== "—" ? (
        <div className="cf-excel-list-mobile-foot">
          <button
            type="button"
            className="cf-open-btn"
            onClick={(e) => {
              e.stopPropagation();
              onActivate(item);
            }}
          >
            {label}
          </button>
        </div>
      ) : null}
    </article>
  );
}

export default function ConfirmationExcelList({
  items,
  isRepoAdmin,
  listFilter,
  onView,
  onInventory,
}) {
  const showInventoryCol = showInventoryColumn(listFilter);
  const showTracerCols = isRepoAdmin;

  const handleActivate = (item) => {
    const status = String(item?.status || "").toUpperCase();
    if (isRepoAdmin) {
      onView(item);
      return;
    }
    if (status === "CONFIRMED") {
      onInventory(item);
    }
  };

  return (
    <div className="cf-excel-list-responsive">
      <div className="cf-excel-list-mobile" aria-label="Confirmations list">
        {items.map((item) => (
          <ConfirmationMobileExcelCard
            key={item._id}
            item={item}
            isRepoAdmin={isRepoAdmin}
            showInventoryCol={showInventoryCol}
            onActivate={handleActivate}
          />
        ))}
      </div>

      <div className="cf-excel-list-desktop company-table-wrap cf-excel-sheet cf-excel-sheet--list">
        <p className="cf-excel-scroll-hint" aria-hidden="true">
          Scroll horizontally to see all columns
        </p>
        <div className="table-scroll">
          <table className="users-table excel-grid-table cf-excel-list-table">
            <thead>
              <tr>
                <th>Case Code</th>
                <th>Registration Number</th>
                <th>Customer Name</th>
                {isRepoAdmin ? <th>Bank Name</th> : null}
                {isRepoAdmin ? <th>Branch Name</th> : null}
                <th>Status</th>
                {showTracerCols ? <th>Traced By</th> : null}
                {showTracerCols ? <th>Role</th> : null}
                {showTracerCols ? <th>Reporter Mobile</th> : null}
                <th>Field Note</th>
                <th>Reported At</th>
                {showInventoryCol ? <th>Inventory</th> : null}
                <th className="cf-action-th">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const clickable = isRowClickable(item, isRepoAdmin);
                const label = actionLabel(item, isRepoAdmin);

                return (
                  <tr
                    key={item._id}
                    className={rowClassName(item, isRepoAdmin)}
                    onClick={() => {
                      if (clickable) handleActivate(item);
                    }}
                  >
                    <td>{item.caseCode || "—"}</td>
                    <td>{formatVehicleNumberDisplay(item.vehicleNumber) || "—"}</td>
                    <td>{item.customerName || "—"}</td>
                    {isRepoAdmin ? <td>{item.bankName || "—"}</td> : null}
                    {isRepoAdmin ? <td>{item.branchName || "—"}</td> : null}
                    <td>
                      <span className={statusBadgeClass(item.status)}>{item.status || "—"}</span>
                    </td>
                    {showTracerCols ? <td>{item.requestedByName || "—"}</td> : null}
                    {showTracerCols ? (
                      <td>{item.requestedByRoleLabel || item.requestedByRole || "—"}</td>
                    ) : null}
                    {showTracerCols ? <td>{item.requestedByPhone || "—"}</td> : null}
                    <td className="cf-excel-note">{item.requestNote || "—"}</td>
                    <td>{formatReportedAt(item.createdAt)}</td>
                    {showInventoryCol ? (
                      <td>
                        <InventoryBadge item={item} />
                      </td>
                    ) : null}
                    <td className="cf-action-td" onClick={(e) => e.stopPropagation()}>
                      {clickable && label !== "—" ? (
                        <button
                          type="button"
                          className="cf-open-btn"
                          onClick={() => handleActivate(item)}
                        >
                          {label}
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
