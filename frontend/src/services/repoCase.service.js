import api from "./api";

export const repoCaseService = {
  getCases: async (token, params = {}) => {
    const res = await api.get("/repo-cases", {
      params,
      timeout: params.search || params.hasVehicleNumber ? 180000 : undefined,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  },

  warmSearchCache: async (token) => {
    const res = await api.get("/repo-cases/search/warm", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  getSearchCacheStatus: async (token) => {
    const res = await api.get("/repo-cases/search/status", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  getCaseById: async (id, token) => {
    const res = await api.get(`/repo-cases/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  },

  getVehicleLoaded: async (token, params = {}) => {
    const res = await api.get("/repo-cases/vehicle-loaded", {
      params,
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  saveVehicleLoaded: async (token, payload) => {
    const res = await api.put("/repo-cases/vehicle-loaded", payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  searchTracesByVehicleNumber: async (vehicleNumber, token) => {
    const res = await api.get("/repo-cases/trace-by-vehicle-number", {
      params: { vehicleNumber },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  },

  createCase: async (payload, token) => {
    const res = await api.post("/repo-cases", payload, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  },

  addRemark: async (id, text, token) => {
    const res = await api.post(
      `/repo-cases/${id}/remarks`,
      { text },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return res.data;
  },

  previewCasesExcel: async (formData, token) => {
    const res = await api.post("/uploads/repo-cases/preview", formData, {
      timeout: 0,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "multipart/form-data",
      },
    });
    return res.data;
  },

  uploadCasesExcel: async (formData, token) => {
    const res = await api.post("/uploads/repo-cases", formData, {
      timeout: 0,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "multipart/form-data",
      },
    });
    return res.data;
  },

  /** Fast path: presigned URL for direct browser → S3 upload */
  presignS3Upload: async (payload, token) => {
    const res = await api.post("/uploads/s3/presign", payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  completeS3Upload: async (payload, token) => {
    const res = await api.post("/uploads/s3/complete", payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  getUploadById: async (id, token) => {
    const res = await api.get(`/uploads/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  },

  getUploadBatches: async (token) => {
    const res = await api.get("/uploads", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  },

  deleteUploadBatch: async (uploadId, token) => {
    const res = await api.delete(`/uploads/${uploadId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  },

  getUploadVehicleNumbers: async (uploadId, token) => {
    const res = await api.get(`/uploads/${uploadId}/vehicle-numbers`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  },

  openUploadFile: async (uploadId, token) => {
    const res = await api.get(`/uploads/${uploadId}/file`, {
      responseType: "blob",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const contentType =
      res.headers["content-type"] ||
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const blob = new Blob([res.data], { type: contentType });
    const url = window.URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => window.URL.revokeObjectURL(url), 60000);
  },

  fetchBankNotifyMessage: async (token, payload = {}) => {
    const res = await api.post("/repo-cases/bank-notify-message", payload, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  },

  notifyBankTraced: async (id, payload, token) => {
    const res = await api.post(`/repo-cases/${id}/notify-bank-traced`, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  },
};