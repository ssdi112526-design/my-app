export function resolveConfirmationCaseId(confirmation) {
  const raw = confirmation?.caseId;
  if (!raw) return null;
  if (typeof raw === "object") {
    return raw._id || raw.id || null;
  }
  return String(raw);
}

/** Minimal case shape when full case API is slow or unavailable. */
export function buildFallbackCaseFromConfirmation(confirmation) {
  if (!confirmation) return null;
  const id = resolveConfirmationCaseId(confirmation);
  return {
    _id: id,
    caseCode: confirmation.caseCode || "",
    vehicleNumber: confirmation.vehicleNumber || "",
    customerName: confirmation.customerName || "",
    bankName: confirmation.bankName || "",
    branchName: confirmation.branchName || "",
  };
}

export const CONFIRMATION_VIEWS = {
  ALL: "",
  INVENTORY_CONFIRMED: "inventory-confirmed",
  INVENTORY_PENDING_APPROVAL: "inventory-pending",
};

export function getInventoryStatus(item) {
  if (String(item?.status || "").toUpperCase() !== "CONFIRMED") {
    return { key: "na", label: "—", badgeClass: "cf-badge" };
  }
  if (item.inventoryRevisionRequested) {
    return {
      key: "revision",
      label: "Update needed",
      badgeClass: "cf-badge cf-badge--pending",
    };
  }
  if (item.inventoryConfirmed) {
    return {
      key: "confirmed",
      label: "Inventory confirmed",
      badgeClass: "cf-badge cf-badge--confirmed",
    };
  }
  if (item.inventorySubmitted) {
    return {
      key: "pending-approval",
      label: "Pending admin approval",
      badgeClass: "cf-badge cf-badge--pending",
    };
  }
  return {
    key: "pending-upload",
    label: "Inventory not uploaded",
    badgeClass: "cf-badge cf-badge--pending",
  };
}

export function applyConfirmationViewFilter(items, view) {
  const list = Array.isArray(items) ? items : [];
  if (view === CONFIRMATION_VIEWS.INVENTORY_CONFIRMED) {
    return list.filter((item) => Boolean(item.inventoryConfirmed));
  }
  if (view === CONFIRMATION_VIEWS.INVENTORY_PENDING_APPROVAL) {
    return list.filter(
      (item) =>
        String(item?.status || "").toUpperCase() === "CONFIRMED" &&
        item.inventorySubmitted &&
        !item.inventoryConfirmed
    );
  }
  return list;
}

export function matchesConfirmationSearch(item, query, isRepoAdmin = true) {
  const q = String(query || "")
    .trim()
    .toLowerCase();
  if (!q) return true;
  const haystack = [
    item?.vehicleNumber,
    item?.customerName,
    item?.chassisNumber,
    item?.engineNumber,
    item?.loanAccountNumber,
    ...(isRepoAdmin ? [item?.bankName, item?.branchName] : []),
    item?.caseCode,
    item?.requestedByName,
    item?.requestedByPhone,
    item?.requestNote,
  ]
    .map((v) => String(v || "").toLowerCase())
    .join(" ");
  return haystack.includes(q);
}

export function getListEmptyMessage(listFilter, view, isRepoAdmin) {
  if (view === CONFIRMATION_VIEWS.INVENTORY_CONFIRMED) {
    return "No cases with admin-confirmed inventory yet.";
  }
  if (view === CONFIRMATION_VIEWS.INVENTORY_PENDING_APPROVAL) {
    return "No inventory waiting for your approval.";
  }
  if (listFilter === "CONFIRMED") {
    return isRepoAdmin
      ? "No confirmed traces yet. Confirmed cases appear here after you approve field reports."
      : "No confirmed traces yet. After admin confirms your report, it will show here.";
  }
  if (listFilter === "PENDING") {
    return isRepoAdmin
      ? "No pending traces awaiting review."
      : "No pending trace reports.";
  }
  if (listFilter === "REJECTED") {
    return "No rejected confirmations.";
  }
  return "No confirmations found.";
}

export function getListSectionTitle(listFilter, view) {
  if (view === CONFIRMATION_VIEWS.INVENTORY_CONFIRMED) {
    return "Inventory confirmed";
  }
  if (view === CONFIRMATION_VIEWS.INVENTORY_PENDING_APPROVAL) {
    return "Inventory to review";
  }
  if (listFilter === "PENDING") {
    return "Pending confirmations";
  }
  if (listFilter === "CONFIRMED") {
    return "Confirmed cases";
  }
  if (listFilter === "REJECTED") {
    return "Rejected";
  }
  return "Confirmations";
}

export function getListSectionHint(listFilter, view, isRepoAdmin) {
  if (view === CONFIRMATION_VIEWS.INVENTORY_CONFIRMED) {
    return "Cases where you approved tracer inventory uploads.";
  }
  if (view === CONFIRMATION_VIEWS.INVENTORY_PENDING_APPROVAL) {
    return "Review uploaded files and tap Confirm inventory on each case.";
  }
  if (listFilter === "PENDING") {
    return isRepoAdmin
      ? "WhatsApp, email, SMS, and in-app traces waiting for your decision."
      : "Waiting for repo admin to confirm your field trace.";
  }
  if (listFilter === "CONFIRMED") {
    return isRepoAdmin
      ? "Approved traces — open a case to confirm inventory or notify the bank."
      : "Upload or update inventory pre/post for each confirmed vehicle.";
  }
  return "Browse and open any confirmation below.";
}
