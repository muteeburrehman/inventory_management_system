import { api } from "./axios.js";
import { unwrap } from "./helpers.js";

export async function lookupBarcode(code) {
  const { data } = await api.get("/barcodes/lookup/", { params: { code } });
  return unwrap(data);
}

export async function generateBarcode(sku) {
  const { data } = await api.get("/barcodes/generate/", { params: { sku } });
  return unwrap(data);
}
