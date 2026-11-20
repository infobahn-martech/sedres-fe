import axios from "axios";

const BASE = import.meta.env.VITE_API_ENDPOINT;
// Example: https://infobahn.asia/sedres/   OR  https://infobahn.asia/sedres/api/

const normalizeBaseUrl = (base) => {
  if (!base) return "";
  // ensure ends with /
  return base.endsWith("/") ? base : `${base}/`;
};

const baseURL = (() => {
  const b = normalizeBaseUrl(BASE);
  // If env already contains /api, don’t add again
  if (b.endsWith("/api/")) return b;
  if (b.endsWith("/api")) return `${b}/`;
  return `${b}api/`;
})();

const Gateway = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 30000,
});

// Create a separate axios instance for refresh token calls (without interceptors)
const RefreshGateway = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 30000,
});

// ✅ Attach token
Gateway.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    // If FormData is being sent, remove Content-Type header to let axios set it automatically
    // with the proper multipart/form-data boundary
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Flag to prevent multiple simultaneous refresh attempts
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// ✅ Handle 401 and token refresh
Gateway.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config;

    // If error is 401 and we haven't already tried to refresh
    if (error?.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return Gateway(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem("refreshToken");

      if (!refreshToken) {
        // No refresh token, logout user
        processQueue(error, null);
        isRefreshing = false;
        // You might want to redirect to login here
        return Promise.reject(error);
      }

      try {
        // Call refresh token endpoint using RefreshGateway (no interceptors)
        const response = await RefreshGateway.post("users/refresh_token", { refresh_token: refreshToken });
        const { access_token } = response.data;

        if (access_token) {
          // Update access token in localStorage
          localStorage.setItem("accessToken", access_token);

          // Update the original request with new token
          originalRequest.headers.Authorization = `Bearer ${access_token}`;

          // Process queued requests
          processQueue(null, access_token);
          isRefreshing = false;

          // Retry the original request
          return Gateway(originalRequest);
        } else {
          throw new Error("No access token in refresh response");
        }
      } catch (refreshError) {
        // Refresh failed, logout user
        processQueue(refreshError, null);
        isRefreshing = false;

        // Clear tokens
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");

        // You might want to redirect to login here
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default Gateway;
