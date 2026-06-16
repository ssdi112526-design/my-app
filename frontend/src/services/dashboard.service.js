import api from "./api";

export const dashboardService = {
  getPendingConfirmationsCount: async () => {
    const response = await api.get("/confirmations/stats/pending-count");
    return response.data;
  },

  getTodayActivity: async () => {
    const response = await api.get("/repo-cases/stats/today-activity");
    return response.data;
  },

  getConfirmationsCount: async () => {
    const response = await api.get("/confirmations/stats/count");
    return response.data;
  },

  getInventoryConfirmedCount: async () => {
    const response = await api.get("/confirmations/stats/inventory-confirmed-count");
    return response.data;
  },

  getTotalCases: async () => {
    const response = await api.get("/repo-cases", {
      params: { page: 1, limit: 1 },
    });
    return response.data;
  },

  /** Cases + today activity (includes S3-only uploads when Mongo has no rows). */
  getStatsOverview: async () => {
    const response = await api.get("/repo-cases/stats/overview");
    return response.data;
  },
};
