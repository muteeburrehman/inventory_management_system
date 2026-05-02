import { api } from "./axios.js";
import { normalizePaged, unwrap } from "./helpers.js";

export async function listNotifications(params = {}) {
  const { data } = await api.get("/notifications/", { params });
  return normalizePaged(data);
}

export async function markNotificationRead(id) {
  const { data } = await api.post(`/notifications/${id}/read/`);
  return unwrap(data);
}

export async function markAllNotificationsRead() {
  const { data } = await api.post("/notifications/read-all/");
  return unwrap(data);
}
