import api from "./api";

export const dashboardService = {
  getStats: async (token) => {
    const res = await api.get("/repo-cases/stats", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  },
};

export default dashboardService;