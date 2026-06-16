import api from "./api";

const repoAdminService = {
  verifyControlPanel: async (password, token) => {
    const res = await api.post(
      "/repo-admin/verify-control-panel",
      { password },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return res.data;
  },

  getMyCompany: async (token) => {
    const res = await api.get("/repo-admin/company", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  },

  updateMyCompany: async (body, token) => {
    const res = await api.patch("/repo-admin/company", body, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  },

  uploadMyCompanyPhoto: async (file, token) => {
    const formData = new FormData();
    formData.append("photo", file);
    const res = await api.post("/repo-admin/company/photo", formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "multipart/form-data",
      },
    });
    return res.data;
  },

  getDashboard: async (token) => {
    const res = await api.get("/repo-admin/dashboard", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  },

  getSubscription: async (token) => {
    const res = await api.get("/repo-admin/subscription", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  },

  downloadCompanyExcel: async (token) => {
    return api.get("/repo-admin/company/export", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      responseType: "blob",
    });
  },
};

export default repoAdminService;
