import { api } from "./axios.js";
import { normalizePaged, unwrap } from "./helpers.js";

export async function getStock(params = {}) {
  const { data } = await api.get("/inventory/stock/", { params });
  return normalizePaged(data);
}

export async function postAdjustment(body) {
  const { data } = await api.post("/inventory/adjustment/", body);
  return unwrap(data);
}

export async function postTransfer(body) {
  const { data } = await api.post("/inventory/transfer/", body);
  return unwrap(data);
}

export async function listMovements(params = {}) {
  const { data } = await api.get("/inventory/movements/", { params });
  return normalizePaged(data);
}

export async function listTransfers(params = {}) {
  const { data } = await api.get("/inventory/transfers/", { params });
  return normalizePaged(data);
}

export async function completeTransfer(id) {
  const { data } = await api.post("/inventory/transfer/complete/", { id });
  return unwrap(data);
}
