const router = require("express").Router();
const multer = require("multer");
const { protect, authorize, requireAuth } = require("../../middlewares/auth");
const c = require("./bank.controller");

const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 80 * 1024 * 1024 },
});

// ── Public ──
router.post("/register", c.selfRegister);
router.post("/login", c.bankLogin);
router.get("/public/banks", c.listPublicBanks);
router.get("/invite/:token", c.getInviteByToken);

// ── S3 upload pipeline ──
router.post(
  "/uploads/presign",
  ...requireAuth(["BANK_ADMIN", "BANK_PERSON"]),
  c.presignBankUpload
);
router.post(
  "/uploads/proxy",
  ...requireAuth(["BANK_ADMIN", "BANK_PERSON"]),
  excelUpload.single("file"),
  c.proxyBankUpload
);
router.post(
  "/uploads/complete",
  ...requireAuth(["BANK_ADMIN", "BANK_PERSON"]),
  c.completeBankUpload
);
router.get(
  "/uploads",
  ...requireAuth(["BANK_ADMIN", "BANK_PERSON"]),
  c.listBankUploads
);
router.get(
  "/uploads/:batchId",
  ...requireAuth(["BANK_ADMIN", "BANK_PERSON"]),
  c.getBankUploadBatch
);
router.delete(
  "/uploads/:batchId/records",
  ...requireAuth(["BANK_ADMIN", "BANK_PERSON"]),
  c.deleteBatchRecords
);

// ── Bank Admin + Bank Person (authenticated bank users) ──
router.get(
  "/records",
  ...requireAuth(["BANK_ADMIN", "BANK_PERSON"]),
  c.listRecords
);
router.get(
  "/records/:id",
  ...requireAuth(["BANK_ADMIN", "BANK_PERSON", "REPO_ADMIN"]),
  c.getRecordById
);
router.delete(
  "/records/:id",
  ...requireAuth(["BANK_ADMIN", "BANK_PERSON"]),
  c.deleteRecord
);
router.post(
  "/records",
  ...requireAuth(["BANK_ADMIN", "BANK_PERSON"]),
  c.createRecord
);
router.post(
  "/records/bulk",
  ...requireAuth(["BANK_ADMIN", "BANK_PERSON"]),
  c.bulkCreateRecords
);
router.get(
  "/tracing",
  ...requireAuth(["BANK_ADMIN", "BANK_PERSON"]),
  c.getTracingView
);

// ── Bank Admin only: manage persons ──
router.get(
  "/persons",
  ...requireAuth(["BANK_ADMIN"]),
  c.listPersons
);
router.post(
  "/persons",
  ...requireAuth(["BANK_ADMIN"]),
  c.createPerson
);
router.patch(
  "/persons/:id/toggle",
  ...requireAuth(["BANK_ADMIN"]),
  c.togglePerson
);

// ── Repo Admin: access linked bank records ──
router.get(
  "/repo-records",
  ...requireAuth(["REPO_ADMIN"]),
  c.repoAdminGetLinkedRecords
);
router.get(
  "/repo-records/:id",
  ...requireAuth(["REPO_ADMIN"]),
  c.getRecordById
);
router.post(
  "/repo-records/:recordId/assign",
  ...requireAuth(["REPO_ADMIN"]),
  c.assignRecord
);

router.get(
  "/assigned-records",
  ...requireAuth([
    "TEAM_LEADER",
    "HEAD_OFFICE_STAFF",
    "OFFICE_STAFF",
    "REPO_STAFF",
    "REPO_VIEWER",
  ]),
  c.agencyGetAssignedRecords
);
router.get(
  "/assigned-records/:id",
  ...requireAuth([
    "TEAM_LEADER",
    "HEAD_OFFICE_STAFF",
    "OFFICE_STAFF",
    "REPO_STAFF",
    "REPO_VIEWER",
  ]),
  c.getRecordById
);

// ── SSDI only ──
router.post(
  "/ssdi/create",
  ...requireAuth(["SSDI_SUPER_ADMIN"]),
  c.ssdiCreateBank
);
router.get(
  "/ssdi/list",
  ...requireAuth(["SSDI_SUPER_ADMIN"]),
  c.ssdiListBanks
);
router.get(
  "/ssdi/:id",
  ...requireAuth(["SSDI_SUPER_ADMIN"]),
  c.ssdiGetBank
);
router.patch(
  "/ssdi/:id/status",
  ...requireAuth(["SSDI_SUPER_ADMIN"]),
  c.ssdiUpdateBankStatus
);
router.post(
  "/ssdi/:id/renew",
  ...requireAuth(["SSDI_SUPER_ADMIN"]),
  c.ssdiRenewBank
);
router.post(
  "/ssdi/links",
  ...requireAuth(["SSDI_SUPER_ADMIN"]),
  c.ssdiCreateLink
);
router.get(
  "/ssdi/links/all",
  ...requireAuth(["SSDI_SUPER_ADMIN"]),
  c.ssdiListLinks
);
router.delete(
  "/ssdi/links/:id",
  ...requireAuth(["SSDI_SUPER_ADMIN"]),
  c.ssdiDeleteLink
);
router.post(
  "/ssdi/invites",
  ...requireAuth(["SSDI_SUPER_ADMIN"]),
  c.ssdiCreateInvite
);
router.get(
  "/ssdi/invites/all",
  ...requireAuth(["SSDI_SUPER_ADMIN"]),
  c.ssdiListInvites
);
router.post(
  "/ssdi/run-expiry",
  ...requireAuth(["SSDI_SUPER_ADMIN"]),
  c.runExpiryCheck
);

module.exports = router;
