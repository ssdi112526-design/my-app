import api from "./api";

export const companyBankService = {
  getBanks: async (token) => {
    const res = await api.get("/company-banks", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  },

  createBank: async (payload, token) => {
    const res = await api.post("/company-banks", payload, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  },

  addBranch: async (bankId, payload, token) => {
    const res = await api.post(`/company-banks/${bankId}/branches`, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  },
  updateBranchContacts: async (bankId, branchId, payload, token) => {
    const res = await api.patch(
      `/company-banks/${bankId}/branches/${branchId}/contacts`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return res.data;
  },
};