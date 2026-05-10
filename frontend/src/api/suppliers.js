import { api } from "./axios.js";
import { normalizePaged, unwrap } from "./helpers.js";

export async function listSuppliers(params = {}) {
  const { data } = await api.get("/suppliers/", { params });
  return normalizePaged(data);
}

export async function getSupplier(id) {
  const { data } = await api.get(`/suppliers/${id}/`);
  return unwrap(data);
}

export async function getSupplierLedger(id) {
  const { data } = await api.get(`/suppliers/${id}/ledger/`);
  return unwrap(data);
}

export async function getSupplierPurchaseHistory(id) {
  const { data } = await api.get(`/suppliers/${id}/purchase-history/`);
  return unwrap(data);
}

export async function createSupplier(body) {
  const { data } = await api.post("/suppliers/", body);
  return unwrap(data);
}

export async function updateSupplier(id, body) {
  const { data } = await api.patch(`/suppliers/${id}/`, body);
  return unwrap(data);
}

export async function deleteSupplier(id) {
  try {
    await api.delete(`/suppliers/${id}/`);
  } catch (e) {
    if (e.response?.status === 404) return;
    throw e;
  }
}
