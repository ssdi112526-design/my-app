import api from "./api";

export const notificationService = {
  getNotifications: async (token, params = {}) => {
    const res = await api.get("/notifications", {
      params,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  },

  markRead: async (id, token) => {
    const res = await api.patch(`/notifications/${id}/read`, null, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  },

  markAllRead: async (token) => {
    const res = await api.patch("/notifications/read-all", null, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  },
};
