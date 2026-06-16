import api from "./api";

export const authService = {
  ssdiLogin: async (payload) => {
    const res = await api.post("/auth/ssdi-login", payload);
    return res.data?.data;
  },

  repoAdminLogin: async (payload) => {
    const res = await api.post("/repo-admin/login", payload);
    return res.data?.data;
  },

  repoAgentLogin: async (payload) => {
    const res = await api.post("/auth/repo-agent-login", payload);
    return res.data?.data;
  },

  agentSelfRegister: async (payload) => {
    const res = await api.post("/auth/agent-register", payload);
    return res.data;
  },

  getProfile: async (token) => {
    const res = await api.get("/auth/profile", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  updateProfile: async (payload, token) => {
    const res = await api.patch("/auth/profile", payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  uploadProfilePhoto: async (file, token) => {
    const formData = new FormData();
    formData.append("photo", file);
    const res = await api.post("/auth/profile/photo", formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "multipart/form-data",
      },
    });
    return res.data;
  },

  getIdCardData: async (token) => {
    const res = await api.get("/auth/id-card-data", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },
};