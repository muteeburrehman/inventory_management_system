import { api } from "./axios.js";
import { normalizePaged, unwrap } from "./helpers.js";

export async function createSale(payload) {
  const { data } = await api.post("/sales/", payload);
  return unwrap(data);
}

export async function listHeldSales(params = {}) {
  const { data } = await api.get("/sales/held/", { params });
  return normalizePaged(data);
}

export async function holdSale(payload) {
  const { data } = await api.post("/sales/hold/", payload);
  return unwrap(data);
}

export async function validateCoupon(code, subtotal) {
  const { data } = await api.post("/coupons/validate/", { code, subtotal });
  return unwrap(data);
}
