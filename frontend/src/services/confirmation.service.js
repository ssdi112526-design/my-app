import api from "./api";

const confirmationService = {
  create: async (payload, token) => {
    const res = await api.post("/confirmations", payload, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  },

  getAll: async (token, params = {}) => {
    const res = await api.get("/confirmations", {
      params,
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: 30000,
    });
    return res.data;
  },

  getById: async (id, token) => {
    const res = await api.get(`/confirmations/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: 25000,
    });
    return res.data;
  },

  submitInventory: async (id, formData, token) => {
    const res = await api.post(`/confirmations/${id}/inventory`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "multipart/form-data",
      },
    });
    return res.data;
  },

  review: async (id, payload, token) => {
    const res = await api.post(`/confirmations/${id}/review`, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  },

  requestInventoryRevision: async (id, payload, token) => {
    const res = await api.post(`/confirmations/${id}/inventory/request-revision`, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  },

  confirmInventory: async (id, token) => {
    const res = await api.post(
      `/confirmations/${id}/inventory/confirm`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return res.data;
  },
};

export default confirmationService;
