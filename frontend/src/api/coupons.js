import { api } from "./axios.js";
import { normalizePaged, unwrap } from "./helpers.js";

export async function listCoupons(params = {}) {
  const { data } = await api.get("/coupons/", { params });
  return normalizePaged(data);
}

export async function createCoupon(body) {
  const { data } = await api.post("/coupons/", body);
  return unwrap(data);
}

export async function updateCoupon(id, body) {
  const { data } = await api.patch(`/coupons/${id}/`, body);
  return unwrap(data);
}

export async function deleteCoupon(id) {
  await api.delete(`/coupons/${id}/`);
}
