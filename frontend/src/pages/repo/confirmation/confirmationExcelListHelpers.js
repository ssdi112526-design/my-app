import { formatVehicleNumberDisplay } from "../../../utils/vehicleNumberUtils";
import { getInventoryStatus } from "./confirmationListUtils";

export function formatReportedAt(value, short = false) {
  if (!value) return "—";
  try {
    const d = new Date(value);
    if (short) {
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

export function statusBadgeClass(status) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "PENDING") return "cf-badge cf-badge--pending";
  if (normalized === "CONFIRMED") return "cf-badge cf-badge--confirmed";
  if (normalized === "REJECTED") return "cf-badge cf-badge--rejected";
  return "cf-badge";
}

export function showInventoryColumn(listFilter) {
  return String(listFilter || "").toUpperCase() === "CONFIRMED";
}

export function actionLabel(item, isRepoAdmin) {
  const status = String(item?.status || "").toUpperCase();
  if (isRepoAdmin) {
    if (status === "PENDING") return "Review";
    return "View";
  }
  if (status === "CONFIRMED") {
    const inv = getInventoryStatus(item);
    if (inv.key === "pending-upload" || inv.key === "revision") return "Inventory";
    return "View";
  }
  return "—";
}

export function isRowClickable(item, isRepoAdmin) {
  const status = String(item?.status || "").toUpperCase();
  return isRepoAdmin || status === "CONFIRMED";
}

export function rowClassName(item, isRepoAdmin) {
  const status = String(item?.status || "").toUpperCase();
  const needsInventory =
    !isRepoAdmin && status === "CONFIRMED" && !item.inventorySubmitted;
  return [
    status === "PENDING" ? "confirmation-row-pending" : "",
    isRowClickable(item, isRepoAdmin) ? "confirmation-row-clickable" : "",
    needsInventory ? "confirmation-row-needs-inventory" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Label/value rows for mobile Excel stack (one case). */
export function buildMobileExcelRows(item, { isRepoAdmin, showInventoryCol }) {
  const rows = [
    {
      label: "Registration Number",
      value: formatVehicleNumberDisplay(item.vehicleNumber) || "—",
    },
    { label: "Customer Name", value: item.customerName || "—" },
    { label: "Case Code", value: item.caseCode || "—" },
    ...(isRepoAdmin
      ? [
          {
            label: "Bank / Branch",
            value: [item.bankName, item.branchName].filter(Boolean).join(" / ") || "—",
          },
        ]
      : []),
    { label: "Status", value: item.status || "—", isStatus: true },
  ];

  if (isRepoAdmin) {
    rows.push(
      { label: "Traced By", value: item.requestedByName || "—" },
      {
        label: "Role",
        value: item.requestedByRoleLabel || item.requestedByRole || "—",
      },
      { label: "Reporter Mobile", value: item.requestedByPhone || "—" }
    );
  }

  rows.push({ label: "Reported At", value: formatReportedAt(item.createdAt, true) });

  if (item.requestNote) {
    rows.push({ label: "Field Note", value: item.requestNote });
  }

  if (showInventoryCol) {
    const inv = getInventoryStatus(item);
    rows.push({
      label: "Inventory",
      value: inv.key === "na" ? "—" : inv.label,
      inventory: inv,
    });
  }

  return rows;
}
