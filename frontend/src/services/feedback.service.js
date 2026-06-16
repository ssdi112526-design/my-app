import api from "./api";

const feedbackService = {
  create: async (payload, token) => {
    const res = await api.post("/feedback", payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  getAll: async (token) => {
    const res = await api.get("/feedback", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  getSsdiAll: async (token) => {
    const res = await api.get("/feedback/ssdi", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },
};

export default feedbackService;
