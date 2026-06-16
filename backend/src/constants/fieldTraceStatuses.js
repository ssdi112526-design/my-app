/** Field tracer statuses (spec-aligned; separate from repoStatus workflow). */
const FIELD_TRACE_STATUSES = [
  "PENDING",
  "TRACING",
  "TRACED",
  "NOT_FOUND",
  "WRONG_ADDRESS",
  "CUSTOMER_SHIFTED",
  "VEHICLE_PARKED",
  "REPOSSESSED",
  "CLOSED",
  "LEGAL_HOLD",
];

const FIELD_TRACE_STATUS_LABELS = {
  PENDING: "Pending",
  TRACING: "Tracing",
  TRACED: "Traced",
  NOT_FOUND: "Not Found",
  WRONG_ADDRESS: "Wrong Address",
  CUSTOMER_SHIFTED: "Customer Shifted",
  VEHICLE_PARKED: "Vehicle Parked",
  REPOSSESSED: "Repossessed",
  CLOSED: "Closed",
  LEGAL_HOLD: "Legal Hold",
};

module.exports = {
  FIELD_TRACE_STATUSES,
  FIELD_TRACE_STATUS_LABELS,
};
