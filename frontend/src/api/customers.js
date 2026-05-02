import { api } from "./axios.js";
import { normalizePaged, unwrap } from "./helpers.js";

export async function listCustomers(params = {}) {
  const { data } = await api.get("/customers/", { params });
  return normalizePaged(data);
}

export async function createCustomer(body) {
  const { data } = await api.post("/customers/", body);
  return unwrap(data);
}

export async function updateCustomer(id, body) {
  const { data } = await api.put(`/customers/${id}/`, body);
  return unwrap(data);
}

export async function deleteCustomer(id) {
  await api.delete(`/customers/${id}/`);
}
