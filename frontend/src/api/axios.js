import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL || "/api/v1";
const accessKey = import.meta.env.VITE_ACCESS_TOKEN_KEY || "ims_access_token";
const refreshKey = import.meta.env.VITE_REFRESH_TOKEN_KEY || "ims_refresh_token";

export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
});

function getAccess() {
  return localStorage.getItem(accessKey);
}

function getRefresh() {
  return localStorage.getItem(refreshKey);
}

function setTokens(access, refresh) {
  if (access) localStorage.setItem(accessKey, access);
  if (refresh) localStorage.setItem(refreshKey, refresh);
}

function clearTokens() {
  localStorage.removeItem(accessKey);
  localStorage.removeItem(refreshKey);
}

api.interceptors.request.use((config) => {
  const token = getAccess();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshing = null;

function requestUrl(config) {
  if (!config) return "";
  const base = config.baseURL ?? "";
  const path = config.url ?? "";
  return `${base}${path}`;
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (!original) {
      return Promise.reject(error);
    }

    const url = requestUrl(original);
    const isAuthLogin = url.includes("/auth/login");
    const isAuthRefresh = url.includes("/auth/refresh");

    if (error.response?.status === 401 && !original._retry) {
      // Wrong password / invalid credentials — must not refresh or hard-redirect.
      if (isAuthLogin) {
        return Promise.reject(error);
      }
      // Refresh token rejected — never attempt a nested refresh.
      if (isAuthRefresh) {
        clearTokens();
        return Promise.reject(error);
      }

      original._retry = true;
      const refresh = getRefresh();
      if (!refresh) {
        clearTokens();
        window.location.href = "/login";
        return Promise.reject(error);
      }
      try {
        if (!refreshing) {
          refreshing = axios
            .post(`${baseURL}/auth/refresh/`, { refresh })
            .then((r) => {
              const envelope = r.data;
              const data = envelope?.data ?? envelope;
              const access = data.access_token ?? data.access;
              const newRefresh = data.refresh_token ?? data.refresh;
              if (access) setTokens(access, newRefresh || refresh);
              return access;
            })
            .finally(() => {
              refreshing = null;
            });
        }
        const access = await refreshing;
        if (access) {
          original.headers.Authorization = `Bearer ${access}`;
          return api(original);
        }
      } catch {
        clearTokens();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export { setTokens, clearTokens, getAccess, getRefresh, accessKey, refreshKey };
