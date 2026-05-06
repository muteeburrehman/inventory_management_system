import { api, clearTokens, getRefresh, setTokens } from "./axios.js";

export async function login(username, password) {
  const { data } = await api.post("/auth/login/", { username, password });
  const envelope = data?.data ?? data;
  const access = envelope.access_token ?? envelope.access;
  const refresh = envelope.refresh_token ?? envelope.refresh;
  if (access) setTokens(access, refresh);
  return envelope;
}

/** Revoke refresh session server-side (Redis) and clear local tokens. */
export async function logoutRemote() {
  const refresh = getRefresh();
  try {
    await api.post("/auth/logout/", refresh ? { refresh } : {});
  } catch {
    /* still clear locally */
  }
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

export async function changePassword(oldPassword, newPassword, refresh) {
  const body = { old_password: oldPassword, new_password: newPassword };
  if (refresh) body.refresh = refresh;
  const { data } = await api.post("/auth/password/change/", body);
  return data?.data ?? data;
}

export async function forgotPassword(email) {
  const { data } = await api.post("/auth/password/forgot/", { email });
  return data?.data ?? data;
}

export async function resetPassword(token, password) {
  const { data } = await api.post("/auth/password/reset/", { token, password });
  return data?.data ?? data;
}

export async function invitePreflight(token) {
  const { data } = await api.get("/auth/invitations/preflight/", { params: { token } });
  return data?.data ?? data;
}

export async function acceptInvite(token, password) {
  const { data } = await api.post("/auth/invitations/accept/", { token, password });
  return data?.data ?? data;
}
