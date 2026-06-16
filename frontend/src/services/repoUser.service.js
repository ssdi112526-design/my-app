import api from "./api";

export const repoUserService = {
  getUsers: async (token, params = {}) => {
    const res = await api.get("/repo-users", {
      params,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  },

  getUserById: async (id, token) => {
    const res = await api.get(`/repo-users/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  },

  sendPhoneOtp: async (phone, token) => {
    const res = await api.post(
      "/repo-users/phone/send-otp",
      { phone },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return res.data;
  },

  verifyPhoneOtp: async (phone, otp, token) => {
    const res = await api.post(
      "/repo-users/phone/verify-otp",
      { phone, otp },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return res.data;
  },

  getConnectEligibility: async (token) => {
    const res = await api.get("/repo-users/connect-eligibility", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  },

  createUser: async (payload, token) => {
    const res = await api.post("/repo-users", payload, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  },

  updateUser: async (id, payload, token) => {
    const res = await api.put(`/repo-users/${id}`, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  },

  changeUserStatus: async (id, isActive, token) => {
    const res = await api.patch(
      `/repo-users/${id}/status`,
      { isActive },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return res.data;
  },

  resetUserPassword: async (id, newPassword, token) => {
    const res = await api.post(
      `/repo-users/${id}/reset-password`,
      { newPassword },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return res.data;
  },

  downloadUsersExcel: async (token, params = {}) => {
    return api.get("/export/repo-users", {
      params,
      headers: {
        Authorization: `Bearer ${token}`,
      },
      responseType: "blob",
    });
  },
};