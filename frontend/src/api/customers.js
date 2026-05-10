import { api } from "./axios.js";
import { normalizePaged, unwrap } from "./helpers.js";

export async function listCustomers(params = {}) {
  const { data } = await api.get("/customers/", { params });
  return normalizePaged(data);
}

export async function getCustomer(id) {
  const { data } = await api.get(`/customers/${id}/`);
  return unwrap(data);
}

export async function getCustomerLedger(id) {
  const { data } = await api.get(`/customers/${id}/ledger/`);
  return unwrap(data);
}

export async function getCustomerPurchaseHistory(id) {
  const { data } = await api.get(`/customers/${id}/purchase-history/`);
  return unwrap(data);
}

export async function getCustomerPaymentHistory(id) {
  const { data } = await api.get(`/customers/${id}/payment-history/`);
  return unwrap(data);
}

export async function createCustomer(body) {
  const { data } = await api.post("/customers/", body);
  return unwrap(data);
}

export async function updateCustomer(id, body) {
  const { data } = await api.patch(`/customers/${id}/`, body);
  return unwrap(data);
}

export async function deleteCustomer(id) {
  try {
    await api.delete(`/customers/${id}/`);
  } catch (e) {
    // Idempotent: already removed or stale UI after another tab/action.
    if (e.response?.status === 404) return;
    throw e;
  }
}
