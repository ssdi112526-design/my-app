/** PostgreSQL table names for each Mongoose model. */
const TABLE_NAMES = {
  User: "users",
  Company: "companies",
  Plan: "plans",
  Subscription: "subscriptions",
  Payment: "payments",
  RepoCase: "repo_cases",
  UploadBatch: "upload_batches",
  Confirmation: "confirmations",
  Bank: "banks",
  BankRecord: "bank_records",
  Notification: "notifications",
  BlacklistEntry: "blacklist_entries",
  Feedback: "feedbacks",
  FinanceEntry: "finance_entries",
  OtpLog: "otp_logs",
  AuditLog: "audit_logs",
  LocationSnapshot: "location_snapshots",
  CompanyBank: "company_banks",
  UserPhoneOtp: "user_phone_otps",
  VehicleLoadedNote: "vehicle_loaded_notes",
  PendingRepoAdminPhoneOtp: "pending_repo_admin_phone_otps",
  BankRepoLink: "bank_repo_links",
  BankUploadBatch: "bank_upload_batches",
  PendingBankInvite: "pending_bank_invites",
  DataUsageLog: "data_usage_logs",
};

/** Default mongoose collection names — used by the Mongo → Postgres import script. */
const MONGO_COLLECTIONS = {
  User: "users",
  Company: "companies",
  Plan: "plans",
  Subscription: "subscriptions",
  Payment: "payments",
  RepoCase: "repocases",
  UploadBatch: "uploadbatches",
  Confirmation: "confirmations",
  Bank: "banks",
  BankRecord: "bankrecords",
  Notification: "notifications",
  BlacklistEntry: "blacklistentries",
  Feedback: "feedbacks",
  FinanceEntry: "financeentries",
  OtpLog: "otplogs",
  AuditLog: "auditlogs",
  LocationSnapshot: "locationsnapshots",
  CompanyBank: "companybanks",
  UserPhoneOtp: "userphoneotps",
  VehicleLoadedNote: "vehicleloadednotes",
  PendingRepoAdminPhoneOtp: "pendingrepoadminphoneotps",
  BankRepoLink: "bankrepolinks",
  BankUploadBatch: "bankuploadbatches",
  PendingBankInvite: "pendingbankinvites",
  DataUsageLog: "datausagelogs",
};

function tableFor(modelName) {
  return TABLE_NAMES[modelName] || `${modelName.toLowerCase()}s`;
}

module.exports = { TABLE_NAMES, MONGO_COLLECTIONS, tableFor };
