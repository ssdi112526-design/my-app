import axios from "axios";
import { emitAuthExpired, getStoredAuth } from "../utils/storage";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

function isPublicAuthRequest(config) {
  const url = String(config?.url || "");
  return /\/(ssdi-login|repo-agent-login|repo-admin\/login|auth\/login|bank\/login|agent-register|bootstrap-ssdi-admin)/.test(
    url
  );
}

api.interceptors.request.use(
  (config) => {
    const savedAuth = getStoredAuth();

    if (savedAuth?.token) {
      config.headers.Authorization = `Bearer ${savedAuth.token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const hadToken = Boolean(getStoredAuth()?.token);

    if (
      status === 401 &&
      hadToken &&
      !isPublicAuthRequest(error?.config) &&
      !error?.config?.skipAuthExpire
    ) {
      emitAuthExpired();
    }

    return Promise.reject(error);
  }
);

export default api;
