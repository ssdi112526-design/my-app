import { getFullAddress, safeValue } from "../pages/repo/vehicles/findVehiclesHelpers";

/** Minimal case fields on admin confirmation detail (/confirmation/:id). */
export const CONFIRMATION_VIEW_FIELD_ROWS = [
  { label: "Mobile Number", get: (c) => safeValue(c.mobileNumber) },
  { label: "Full Address", get: (c) => getFullAddress(c) },
  { label: "City", get: (c) => safeValue(c.city) },
  { label: "State", get: (c) => safeValue(c.state) },
  { label: "Pincode", get: (c) => safeValue(c.pincode) },
  { label: "EMI Amount", get: (c) => safeValue(c.emiAmount) },
  { label: "Due Amount", get: (c) => safeValue(c.dueAmount) },
  { label: "Outstanding Amount", get: (c) => safeValue(c.totalOutstandingAmount) },
  { label: "Bucket", get: (c) => safeValue(c.bucket) },
  { label: "Priority", get: (c) => safeValue(c.priority) },
  { label: "Field Notes", get: (c) => safeValue(c.fieldNotes) },
  { label: "Repo Status", get: (c) => safeValue(c.repoStatus) },
];
