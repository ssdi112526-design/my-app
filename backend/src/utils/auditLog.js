const AuditLog = require("../modules/auditLogs/auditLog.model");

async function writeAuditLog({
  companyId = null,
  userId = null,
  userName = "",
  role = "",
  action,
  entity = "",
  entityId = null,
  meta = {},
}) {
  if (!action) return null;
  try {
    return await AuditLog.create({
      companyId,
      userId,
      userName,
      role,
      action,
      entity,
      entityId,
      meta,
    });
  } catch (err) {
    console.warn("[audit]", err.message);
    return null;
  }
}

module.exports = { writeAuditLog };
