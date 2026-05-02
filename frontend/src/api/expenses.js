import { api } from "./axios.js";
import { normalizePaged, unwrap } from "./helpers.js";

export async function listExpenseCategories(params = {}) {
  const { data } = await api.get("/expenses/categories/", { params });
  return normalizePaged(data);
}

export async function createExpenseCategory(body) {
  const { data } = await api.post("/expenses/categories/", body);
  return unwrap(data);
}

export async function updateExpenseCategory(id, body) {
  const { data } = await api.put(`/expenses/categories/${id}/`, body);
  return unwrap(data);
}

export async function deleteExpenseCategory(id) {
  await api.delete(`/expenses/categories/${id}/`);
}

export async function listExpenses(params = {}) {
  const { data } = await api.get("/expenses/", { params });
  return normalizePaged(data);
}

export async function createExpense(body) {
  const { data } = await api.post("/expenses/", body);
  return unwrap(data);
}

export async function updateExpense(id, body) {
  const { data } = await api.put(`/expenses/${id}/`, body);
  return unwrap(data);
}

export async function deleteExpense(id) {
  await api.delete(`/expenses/${id}/`);
}
