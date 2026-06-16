const EXPORT_LIMIT = 5000;

function buildCompanyFilter(query = {}) {
  const q = (query.q || "").trim();
  const status = (query.status || "").trim();
  const code = (query.code || query.companyCode || "").trim();
  const name = (query.name || query.companyName || "").trim();
  const email = (query.email || "").trim();
  const phone = (query.phone || "").trim();

  const filter = {};

  if (q) {
    filter.$or = [
      { companyName: { $regex: q, $options: "i" } },
      { companyCode: { $regex: q, $options: "i" } },
      { email: { $regex: q, $options: "i" } },
      { phone: { $regex: q, $options: "i" } },
    ];
  }

  if (code) {
    filter.companyCode = { $regex: code, $options: "i" };
  }
  if (name) {
    filter.companyName = { $regex: name, $options: "i" };
  }
  if (email) {
    filter.email = { $regex: email, $options: "i" };
  }
  if (phone) {
    filter.phone = { $regex: phone, $options: "i" };
  }

  if (status === "ACTIVE" || status === "INACTIVE" || status === "PENDING") {
    filter.status = status;
  }

  const registrationSource = (query.registrationSource || "").trim();
  if (registrationSource === "SELF" || registrationSource === "ADMIN") {
    filter.registrationSource = registrationSource;
  }

  const paymentStatus = (query.paymentStatus || "").trim();
  if (paymentStatus === "PAID" || paymentStatus === "UNPAID") {
    filter.paymentStatus = paymentStatus;
  }

  return filter;
}

module.exports = {
  buildCompanyFilter,
  EXPORT_LIMIT,
};
