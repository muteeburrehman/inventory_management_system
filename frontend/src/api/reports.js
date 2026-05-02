import { api } from "./axios.js";
import { unwrap } from "./helpers.js";

export async function salesReport(params = {}) {
  const { data } = await api.get("/reports/sales/", { params });
  return unwrap(data);
}

export async function purchasesReport(params = {}) {
  const { data } = await api.get("/reports/purchases/", { params });
  return unwrap(data);
}

export async function inventoryReport(params = {}) {
  const { data } = await api.get("/reports/inventory/", { params });
  return unwrap(data);
}

export async function profitReport(params = {}) {
  const { data } = await api.get("/reports/profit/", { params });
  return unwrap(data);
}

export async function expensesReport(params = {}) {
  const { data } = await api.get("/reports/expenses/", { params });
  return unwrap(data);
}

export async function duePaymentsReport(params = {}) {
  const { data } = await api.get("/reports/due-payments/", { params });
  return unwrap(data);
}

export async function dayClosingReport(params = {}) {
  const { data } = await api.get("/reports/day-closing/", { params });
  return unwrap(data);
}
