import { api } from "./axios.js";
import { normalizePaged, unwrap } from "./helpers.js";

export async function listPurchases(params = {}) {
  const { data } = await api.get("/purchases/", { params });
  return normalizePaged(data);
}

export async function getPurchase(id) {
  const { data } = await api.get(`/purchases/${id}/`);
  return unwrap(data);
}

export async function createPurchase(body) {
  const { data } = await api.post("/purchases/", body);
  return unwrap(data);
}

export async function updatePurchase(id, body) {
  const { data } = await api.put(`/purchases/${id}/`, body);
  return unwrap(data);
}

export async function deletePurchase(id) {
  await api.delete(`/purchases/${id}/`);
}

export async function purchaseReturn(id, body) {
  const { data } = await api.post(`/purchases/${id}/return/`, body);
  return unwrap(data);
}
