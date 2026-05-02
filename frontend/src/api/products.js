import { api } from "./axios.js";
import { normalizePaged, unwrap } from "./helpers.js";

export async function searchProducts(params) {
  const { data } = await api.get("/products/search/", { params });
  return normalizePaged(data).results;
}

export async function listProducts(params = {}) {
  const { data } = await api.get("/products/", { params });
  return normalizePaged(data);
}

export async function listCategories(params = {}) {
  const { data } = await api.get("/products/categories/", { params });
  return normalizePaged(data);
}

export async function listBrands(params = {}) {
  const { data } = await api.get("/products/brands/", { params });
  return normalizePaged(data);
}
