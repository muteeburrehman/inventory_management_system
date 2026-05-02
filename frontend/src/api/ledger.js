import { api } from "./axios.js";
import { normalizePaged, unwrap } from "./helpers.js";

export async function listLedgerEntries(params = {}) {
  const { data } = await api.get("/ledger/", { params });
  return normalizePaged(data);
}

export async function fetchTrialBalance() {
  const { data } = await api.get("/ledger/trial-balance/");
  return unwrap(data);
}

export async function fetchProfitLoss() {
  const { data } = await api.get("/ledger/profit-loss/");
  return unwrap(data);
}

export async function fetchCashFlow() {
  const { data } = await api.get("/ledger/cash-flow/");
  return unwrap(data);
}
