const { formatDate } = require("../../utils/excelExport");

function mapCompanyToExcelRow(company, index = 0) {
  return {
    "S.No.": index + 1,
    "Company Code": company.companyCode || "",
    "Bank / NBFC Name": company.companyName || "",
    Email: company.email || "",
    Phone: company.phone || "",
    "Contact Person": company.contactPersonName || "",
    "Owner Name": company.ownerName || "",
    Address: company.address || "",
    "Aadhaar Number": company.aadhaarNumber || "",
    Status: company.status || "",
    "Block Reason": company.blockReason || "",
    "Blocked Date": formatDate(company.blockedAt),
    "Created Date": formatDate(company.createdAt),
  };
}

module.exports = { mapCompanyToExcelRow };
