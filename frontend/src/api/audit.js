import { api } from "./axios.js";
import { normalizePaged, unwrap } from "./helpers.js";

export async function listAuditLogs(params = {}) {
  const { data } = await api.get("/audit-logs/", { params });
  return normalizePaged(data);
}

export async function getBackupHistory() {
  const { data } = await api.get("/backup/history/");
  return unwrap(data);
}

export function backupExportUrl() {
  const base = api.defaults.baseURL || "/api/v1";
  return `${base.replace(/\/$/, "")}/backup/export/`;
}
