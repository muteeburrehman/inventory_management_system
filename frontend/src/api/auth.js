import { api, clearTokens, setTokens } from "./axios.js";

export async function login(username, password) {
  const { data } = await api.post("/auth/login/", { username, password });
  const envelope = data?.data ?? data;
  const access = envelope.access_token ?? envelope.access;
  const refresh = envelope.refresh_token ?? envelope.refresh;
  if (access) setTokens(access, refresh);
  return envelope;
}

export function logout() {
  clearTokens();
}

export async function fetchMe() {
  const { data } = await api.get("/auth/me/");
  return data?.data ?? data;
}

export async function patchMe(body) {
  const { data } = await api.patch("/auth/me/", body);
  return data?.data ?? data;
}
