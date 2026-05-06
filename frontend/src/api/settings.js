import { api } from "./axios.js";
import { normalizePaged, unwrap } from "./helpers.js";

export async function getBusiness() {
  const { data } = await api.get("/settings/business/");
  return unwrap(data);
}

export async function patchBusiness(body) {
  const { data } = await api.patch("/settings/business/", body);
  return unwrap(data);
}

export async function listBranches(params = {}) {
  const { data } = await api.get("/settings/branches/", { params });
  return normalizePaged(data);
}

export async function listBranchManagerCandidates() {
  const { data } = await api.get("/settings/branches/manager-candidates/");
  const inner = data?.data ?? data;
  return Array.isArray(inner) ? inner : [];
}

export async function createBranch(body) {
  const { data } = await api.post("/settings/branches/", body);
  return unwrap(data);
}

export async function updateBranch(id, body) {
  const { data } = await api.put(`/settings/branches/${id}/`, body);
  return unwrap(data);
}

export async function deleteBranch(id) {
  await api.delete(`/settings/branches/${id}/`);
}

export async function shiftOpen(body) {
  const { data } = await api.post("/settings/shift/open/", body);
  return unwrap(data);
}

export async function shiftClose(body) {
  const { data } = await api.post("/settings/shift/close/", body);
  return unwrap(data);
}
