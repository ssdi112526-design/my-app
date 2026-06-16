import api from "./api";

export const blacklistService = {
  getSsdiEntries: async (token, params = {}) => {
    const res = await api.get("/blacklist/ssdi", {
      params,
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  removeSsdiEntry: async (id, token) => {
    const res = await api.patch(`/blacklist/ssdi/${id}/remove`, null, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  downloadBlacklistExcel: async (token, params = {}) => {
    return api.get("/export/blacklist", {
      params,
      headers: { Authorization: `Bearer ${token}` },
      responseType: "blob",
    });
  },
};
