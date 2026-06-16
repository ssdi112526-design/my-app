import api from "./api";

const planService = {
  getTierPlans: async () => {
    const res = await api.get("/plans/tiers");
    return res.data;
  },

  getPlans: async (token) => {
    const res = await api.get("/plans", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  },

  seedPlans: async (token) => {
    const res = await api.post(
      "/plans/seed",
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return res.data;
  },

  updatePlan: async (id, payload, token) => {
    const res = await api.put(`/plans/${id}`, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  },
};

export default planService;