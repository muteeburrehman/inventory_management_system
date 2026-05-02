import { api } from "./axios.js";
import { normalizePaged, unwrap } from "./helpers.js";

export async function listUsers(params = {}) {
  const { data } = await api.get("/users/", { params });
  return normalizePaged(data);
}

export async function createUser(body) {
  const { data } = await api.post("/users/", body);
  return unwrap(data);
}

export async function updateUser(id, body) {
  const { data } = await api.put(`/users/${id}/`, body);
  return unwrap(data);
}

export async function deleteUser(id) {
  await api.delete(`/users/${id}/`);
}

export async function listPermissions(params = {}) {
  const { data } = await api.get("/users/permissions/", { params });
  return normalizePaged(data);
}

/** Bulk update: array of { id, can_create, can_edit, ... } */
export async function updatePermissions(rows) {
  const { data } = await api.put("/users/permissions/", rows);
  return normalizePaged(data).results;
}
