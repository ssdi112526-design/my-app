function companySnapshot(company) {
  if (!company) return null;

  return {
    companyName: company.companyName,
    companyCode: company.companyCode,
  };
}

module.exports = { companySnapshot };
