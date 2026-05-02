import { api } from "./axios.js";
import { normalizePaged, unwrap } from "./helpers.js";

export async function listSuppliers(params = {}) {
  const { data } = await api.get("/suppliers/", { params });
  return normalizePaged(data);
}

export async function createSupplier(body) {
  const { data } = await api.post("/suppliers/", body);
  return unwrap(data);
}

export async function updateSupplier(id, body) {
  const { data } = await api.put(`/suppliers/${id}/`, body);
  return unwrap(data);
}

export async function deleteSupplier(id) {
  await api.delete(`/suppliers/${id}/`);
}
