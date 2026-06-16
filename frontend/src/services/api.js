import axios from "axios";
import { getStoredAuth, clearStoredAuth } from "../utils/storage";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

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
    if (error?.response?.status === 401) {
      clearStoredAuth();
    }
    return Promise.reject(error);
  }
);

export default api;