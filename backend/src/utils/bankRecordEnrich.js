const {
  buildBankerContactsFromExtra,
  bankerContactsToSnapshot,
} = require("./bankRecordBankerContacts");
const { readBankerFromExcelHeaders } = require("./readBankerFromExcelHeaders");
const {
  coerceBankerNameDisplay,
  coerceBankerPhoneDisplay,
} = require("./bankerValueUtils");

/** Ensure banker fields + contacts array for API clients. */
function enrichBankRecordBankerSnapshot(record) {
  const doc = record?.toObject ? record.toObject() : { ...(record || {}) };
  const extra =
    doc.extraFields && typeof doc.extraFields === "object" ? { ...doc.extraFields } : {};

  const bankerContacts = buildBankerContactsFromExtra(extra);
  const snapshot = bankerContactsToSnapshot(bankerContacts);
  const direct = readBankerFromExcelHeaders(extra);

  for (const key of [
    "banker1Name",
    "banker1Phone",
    "banker2Name",
    "banker2Phone",
    "banker3Name",
    "banker3Phone",
  ]) {
    const raw = direct[key] || "";
    const val = key.endsWith("Phone")
      ? coerceBankerPhoneDisplay(raw)
      : coerceBankerNameDisplay(raw);
    if (val && !snapshot[key]) snapshot[key] = val;
  }

  const mergedContacts = bankerContacts.map((row) => ({
    ...row,
    value: snapshot[row.key] || row.value || "",
  }));

  snapshot.loanNumber = doc.loanAccountNumber || "";

  extra._bankerSnapshot = snapshot;
  doc.extraFields = extra;
  doc.bankerContacts = mergedContacts;
  doc.banker1Name = snapshot.banker1Name || "";
  doc.banker1Phone = snapshot.banker1Phone || "";
  doc.banker2Name = snapshot.banker2Name || "";
  doc.banker2Phone = snapshot.banker2Phone || "";
  doc.banker3Name = snapshot.banker3Name || "";
  doc.banker3Phone = snapshot.banker3Phone || "";
  return doc;
}

module.exports = {
  enrichBankRecordBankerSnapshot,
};
