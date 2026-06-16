import api from "./api";

const companyService = {
  getCompanies: async (token, params = {}) => {
    const res = await api.get("/companies", {
      params,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  },

  getCompanyById: async (id, token) => {
    const res = await api.get(`/companies/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  },

  getNextCompanyCode: async (companyName, token) => {
    const res = await api.get("/companies/next-code", {
      params: { companyName },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  },

  sendRepoAdminPhoneOtp: async (phone, token) => {
    const paths = [
      "/auth/ssdi/repo-admin-phone/send-otp",
      "/companies/repo-admin-phone/send-otp",
    ];
    let lastError;
    for (const path of paths) {
      try {
        const res = await api.post(path, { phone }, {
          headers: { Authorization: `Bearer ${token}` },
        });
        return res.data;
      } catch (err) {
        lastError = err;
        if (err?.response?.status !== 404) throw err;
      }
    }
    throw lastError;
  },

  verifyRepoAdminPhoneOtp: async (phone, otp, token) => {
    const paths = [
      "/auth/ssdi/repo-admin-phone/verify-otp",
      "/companies/repo-admin-phone/verify-otp",
    ];
    let lastError;
    for (const path of paths) {
      try {
        const res = await api.post(path, { phone, otp }, {
          headers: { Authorization: `Bearer ${token}` },
        });
        return res.data;
      } catch (err) {
        lastError = err;
        if (err?.response?.status !== 404) throw err;
      }
    }
    throw lastError;
  },

  createCompany: async (payload, token) => {
    const res = await api.post("/companies", payload, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  },

  registerCompany: async (payload) => {
    const res = await api.post("/companies/register", payload);
    return res.data;
  },

  approveCompany: async (id, token) => {
    const res = await api.post(`/companies/${id}/approve`, {}, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  markCompanyPayment: async (id, payload, token) => {
    const res = await api.post(`/companies/${id}/mark-payment`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  getPendingRegistrations: async (token) => {
    const res = await api.get("/companies/registrations/pending", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  getCompanyUsers: async (id, token) => {
    const res = await api.get(`/companies/${id}/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  updateCompanyUserStatus: async (companyId, userId, isActive, token) => {
    const res = await api.patch(
      `/companies/${companyId}/users/${userId}/status`,
      { isActive },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return res.data;
  },

  uploadCompanyPhoto: async (companyId, file, token) => {
    const formData = new FormData();
    formData.append("photo", file);
    const res = await api.post(`/companies/${companyId}/photo`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "multipart/form-data",
      },
    });
    return res.data;
  },

  uploadRepoAdminPhoto: async (companyId, file, token) => {
    const formData = new FormData();
    formData.append("photo", file);
    const res = await api.post(`/companies/${companyId}/admin-photo`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "multipart/form-data",
      },
    });
    return res.data;
  },

  updateCompany: async (id, payload, token) => {
    const res = await api.put(`/companies/${id}`, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  },

  resetRepoAdminPassword: async (id, newPassword, token) => {
    const res = await api.post(
      `/companies/${id}/reset-repo-admin-password`,
      { newPassword },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return res.data;
  },

  deleteCompany: async (id, token) => {
    const res = await api.delete(`/companies/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  },

  getCompanyStats: async (token) => {
    const res = await api.get("/companies/stats", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  },

  downloadCompaniesExcel: async (token, params = {}) => {
    return api.get("/export/companies", {
      params,
      headers: {
        Authorization: `Bearer ${token}`,
      },
      responseType: "blob",
    });
  },
};

export default companyService;