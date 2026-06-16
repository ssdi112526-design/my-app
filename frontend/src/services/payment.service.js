import api from "./api";

export const subscriptionService = {
  getSubscriptions: async (token) => {
    const res = await api.get("/subscriptions", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  },
};