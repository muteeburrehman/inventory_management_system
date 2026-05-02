import { api } from "./axios.js";
import { normalizePaged, unwrap } from "./helpers.js";

export async function listSales(params = {}) {
  const { data } = await api.get("/sales/", { params });
  return normalizePaged(data);
}

export async function getSale(id) {
  const { data } = await api.get(`/sales/${id}/`);
  return unwrap(data);
}

export async function submitSalesReturn(id, body) {
  const { data } = await api.post(`/sales/${id}/return/`, body);
  return unwrap(data);
}
