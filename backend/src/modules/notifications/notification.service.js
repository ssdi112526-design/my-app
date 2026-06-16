const Notification = require("./notification.model");
const User = require("../users/user.model");

const UPLOAD_NOTIFY_ROLES = [
  "REPO_ADMIN",
  "TEAM_LEADER",
  "HEAD_OFFICE_STAFF",
  "OFFICE_STAFF",
  "REPO_STAFF",
];

async function notifyCompanyRoles(companyId, { title, message, meta = {} }) {
  if (!companyId) return [];

  const users = await User.find({
    companyId,
    role: { $in: UPLOAD_NOTIFY_ROLES },
    isActive: { $ne: false },
  }).select("_id");

  if (!users.length) return [];

  const docs = users.map((user) => ({
    companyId,
    userId: user._id,
    type: "RECORD_UPLOAD",
    title,
    message,
    meta,
  }));

  const created = await Notification.insertMany(docs);

  try {
    const { emitToCompany } = require("../../socket");
    emitToCompany(companyId, "notifications:new", {
      count: created.length,
      title,
    });
  } catch {
    /* socket optional */
  }

  return created;
}

async function notifySsdiSuperAdmins({ companyId, title, message, meta = {} }) {
  if (!companyId) return [];

  const admins = await User.find({
    role: "SSDI_SUPER_ADMIN",
    isActive: { $ne: false },
  }).select("_id");

  if (!admins.length) return [];

  const docs = admins.map((admin) => ({
    companyId,
    userId: admin._id,
    type: "AGENCY_PROFILE_UPDATE",
    title,
    message,
    meta,
  }));

  const created = await Notification.insertMany(docs);
  return created;
}

module.exports = {
  notifyCompanyRoles,
  notifySsdiSuperAdmins,
  UPLOAD_NOTIFY_ROLES,
};
