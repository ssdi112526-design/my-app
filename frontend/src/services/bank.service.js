import api from "./api";

const bankService = {
  // ── Auth ──
  login: (data) => api.post("/bank/login", data),
  listPublicBanks: () => api.get("/bank/public/banks"),
  register: (data) => api.post("/bank/register", data),
  getInviteByToken: (token) => api.get(`/bank/invite/${token}`),

  // ── S3 Upload pipeline ──
  presignUpload: (data) => api.post("/bank/uploads/presign", data),
  proxyUpload: (formData) =>
    api.post("/bank/uploads/proxy", formData, {
      timeout: 0,
      headers: { "Content-Type": "multipart/form-data" },
    }),
  completeUpload: (data) => api.post("/bank/uploads/complete", data),
  listUploads: () => api.get("/bank/uploads"),
  getUploadBatch: (batchId) => api.get(`/bank/uploads/${batchId}`),

  // ── Records ──
  getRecords: (params) => api.get("/bank/records", { params }),
  getRecord: (id) => api.get(`/bank/records/${id}`),
  deleteRecord: (id) => api.delete(`/bank/records/${id}`),
  createRecord: (data) => api.post("/bank/records", data),
  deleteBatchRecords: (batchId) => api.delete(`/bank/uploads/${batchId}/records`),

  // ── Persons (Bank Admin only) ──
  getPersons: () => api.get("/bank/persons"),
  createPerson: (data) => api.post("/bank/persons", data),
  togglePerson: (id) => api.patch(`/bank/persons/${id}/toggle`),

  // ── Tracing ──
  getTracingView: () => api.get("/bank/tracing"),

  // ── Repo Admin: linked bank records ──
  getLinkedRecords: (params) => api.get("/bank/repo-records", { params }),
  getLinkedRecord: (id) => api.get(`/bank/repo-records/${id}`),
  assignRecord: (recordId, tracerId) =>
    api.post(`/bank/repo-records/${recordId}/assign`, { tracerId }),

  getAssignedRecords: (params) => api.get("/bank/assigned-records", { params }),
  getAssignedRecord: (id) => api.get(`/bank/assigned-records/${id}`),

  // ── SSDI ──
  ssdiCreateBank: (data) => api.post("/bank/ssdi/create", data),
  ssdiListBanks: (params) => api.get("/bank/ssdi/list", { params }),
  ssdiGetBank: (id) => api.get(`/bank/ssdi/${id}`),
  ssdiUpdateStatus: (id, data) => api.patch(`/bank/ssdi/${id}/status`, data),
  ssdiRenewBank: (id, data) => api.post(`/bank/ssdi/${id}/renew`, data),

  ssdiCreateLink: (data) => api.post("/bank/ssdi/links", data),
  ssdiListLinks: () => api.get("/bank/ssdi/links/all"),
  ssdiDeleteLink: (id) => api.delete(`/bank/ssdi/links/${id}`),

  ssdiCreateInvite: (data) => api.post("/bank/ssdi/invites", data),
  ssdiListInvites: () => api.get("/bank/ssdi/invites/all"),

  ssdiRunExpiry: () => api.post("/bank/ssdi/run-expiry"),
};

export default bankService;
