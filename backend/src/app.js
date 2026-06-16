const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");

const authRoutes = require("./modules/auth/auth.routes");
const companyRoutes = require("./modules/companies/company.routes");
const planRoutes = require("./modules/plans/plan.routes");
const paymentRoutes = require("./modules/payments/payment.routes");
const repoAdminRoutes = require("./modules/repoAdmin/repoAdmin.routes");
const repoUserRoutes = require("./modules/repoUsers/repoUser.routes");
const repoCaseRoutes = require("./modules/repoCases/repoCase.routes");
const otpLogRoutes = require("./modules/otpLogs/otpLog.routes");
const blacklistRoutes = require("./modules/blacklist/blacklist.routes");
const feedbackRoutes = require("./modules/feedbacks/feedback.routes");
const financeRoutes = require("./modules/finances/finance.routes");
const uploadRoutes = require("./modules/uploads/upload.routes");
const reportRoutes = require("./modules/reports/report.routes");
const subscriptionRoutes = require("./modules/subscriptions/subscription.routes");
const companyBankRoutes = require("./modules/companyBanks/companyBank.routes");
const notificationRoutes = require("./modules/notifications/notification.routes");
const confirmationRoutes = require("./modules/confirmations/confirmation.routes");
const exportRoutes = require("./modules/exports/export.routes");
const fieldTrackingRoutes = require("./modules/fieldTracking/fieldTracking.routes");
const auditLogRoutes = require("./modules/auditLogs/auditLog.routes");
const bankRoutes = require("./modules/bank/bank.routes");
const companyController = require("./modules/companies/company.controller");
const { protect, authorize } = require("./middlewares/auth");

const errorHandler = require("./middlewares/errorHandler");

const app = express();

const corsOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
];
if (process.env.CORS_ORIGIN) {
  corsOrigins.push(
    ...process.env.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean)
  );
}

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
function isDevLanOrigin(origin) {
  if (process.env.NODE_ENV === "production") return false;
  return /^https?:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(
    origin
  );
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || corsOrigins.includes(origin) || isDevLanOrigin(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "API is working." });
});

// routes
app.use("/api/auth", authRoutes);
app.use("/api/export", exportRoutes);

// Repo admin phone OTP (SSDI create company) — registered on app so path is always available
app.post(
  "/api/companies/repo-admin-phone/send-otp",
  protect,
  authorize("SSDI_SUPER_ADMIN"),
  companyController.sendRepoAdminPhoneOtp
);
app.post(
  "/api/companies/repo-admin-phone/verify-otp",
  protect,
  authorize("SSDI_SUPER_ADMIN"),
  companyController.verifyRepoAdminPhoneOtp
);

app.use("/api/companies", companyRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/repo-admin", repoAdminRoutes);
app.use("/api/repo-users", repoUserRoutes);
app.use("/api/repo-cases", repoCaseRoutes);
app.use("/api/otp", otpLogRoutes);
app.use("/api/blacklist", blacklistRoutes);
app.use("/api/confirmations", confirmationRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/finances", financeRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/company-banks", companyBankRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/field-tracking", fieldTrackingRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api/bank", bankRoutes);

// error handler - must be last
app.use(errorHandler);

module.exports = app;