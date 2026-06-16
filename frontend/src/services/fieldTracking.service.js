import api from "./api";

export const fieldTrackingService = {
  getTraceStatuses: async (token) => {
    const res = await api.get("/field-tracking/trace-statuses", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  postLocation: async (caseId, payload, token) => {
    const res = await api.post(`/field-tracking/cases/${caseId}/location`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  /** App-wide live position for admin / team leader field map */
  postMyLocation: async (payload, token) => {
    const res = await api.post("/field-tracking/me/location", payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  patchTraceStatus: async (caseId, payload, token) => {
    const res = await api.patch(`/field-tracking/cases/${caseId}/trace-status`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  getTimeline: async (caseId, token) => {
    const res = await api.get(`/field-tracking/cases/${caseId}/timeline`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  getLocations: async (caseId, token) => {
    const res = await api.get(`/field-tracking/cases/${caseId}/locations`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  getLiveTracers: async (token) => {
    const res = await api.get("/field-tracking/tracers/live", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },
};
