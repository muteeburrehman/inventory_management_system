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

export async function getProduct(id) {
  const { data } = await api.get(`/products/${id}/`);
  return unwrap(data);
}

export async function createProduct(body) {
  const { data } = await api.post("/products/", body);
  return unwrap(data);
}

export async function updateProduct(id, body) {
  const { data } = await api.patch(`/products/${id}/`, body);
  return unwrap(data);
}

export async function deleteProduct(id) {
  await api.delete(`/products/${id}/`);
}

export async function deleteProductVariant(productId, variantId) {
  await api.delete(`/products/${productId}/variants/${variantId}/`);
}

export async function listCategories(params = {}) {
  const { data } = await api.get("/products/categories/", { params });
  return normalizePaged(data);
}

export async function fetchCategoryTree() {
  const { data } = await api.get("/products/categories/tree/");
  return unwrap(data);
}

export async function createCategory(body) {
  const { data } = await api.post("/products/categories/", body);
  return unwrap(data);
}

export async function updateCategory(id, body) {
  const { data } = await api.patch(`/products/categories/${id}/`, body);
  return unwrap(data);
}

export async function deleteCategory(id) {
  await api.delete(`/products/categories/${id}/`);
}

export async function listBrands(params = {}) {
  const { data } = await api.get("/products/brands/", { params });
  return normalizePaged(data);
}

export async function createBrand(body) {
  const { data } = await api.post("/products/brands/", body);
  return unwrap(data);
}

export async function updateBrand(id, body) {
  const { data } = await api.patch(`/products/brands/${id}/`, body);
  return unwrap(data);
}

export async function deleteBrand(id) {
  await api.delete(`/products/brands/${id}/`);
}
