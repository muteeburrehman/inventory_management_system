/**
 * Read error text from our DRF envelope handler or plain Django/DRF bodies.
 */
export function envelopeMessage(error) {
  if (!error?.response) {
    const msg = error?.message;
    if (msg === "Network Error" || msg === "ERR_NETWORK") {
      return (
        "Cannot reach the API. If VITE_API_BASE_URL is /api/v1, run Django on the host/port set in " +
        "vite.config.js (VITE_PROXY_TARGET, default 127.0.0.1:8000) and check the browser console for [vite proxy]. " +
        "Otherwise set VITE_API_BASE_URL to your full API URL and matching CORS on the backend."
      );
    }
    if (typeof msg === "string" && msg) return msg;
    return "Request failed.";
  }
  const d = error?.response?.data;
  if (d && typeof d.message === "string" && d.message) {
    return d.message;
  }
  if (d && typeof d.detail === "string") {
    return d.detail;
  }
  if (d && typeof d === "object" && Array.isArray(d.non_field_errors) && d.non_field_errors.length) {
    const first = d.non_field_errors[0];
    if (typeof first === "string") return first;
  }
  if (Array.isArray(d) && d.length && typeof d[0] === "string") {
    return d[0];
  }
  if (typeof error?.message === "string" && error.message) {
    return error.message;
  }
  return "Request failed.";
}

/**
 * Map DRF validation dict into Ant Design Form field errors.
 *
 * Handles three shapes that come back from DRF:
 *   1. Plain string array:                { sku: ["SKU must be unique."] }
 *      → attached to field `sku`.
 *   2. Nested list-of-objects (child serializers with many=True):
 *                                          { variants: [{ sku: ["..."] }, {}] }
 *      → attached to field path `["variants", index, fieldName]` so the error
 *        renders inline on the correct Form.List row.
 *   3. Mixed: `non_field_errors` and other non-mappable keys are ignored here;
 *      the caller is expected to also display the envelope `message` (see
 *      envelopeMessage) when this returns false.
 *
 * @returns {boolean} true if field errors were applied
 */
export function applyDrfFieldErrors(form, error) {
  const raw = error?.response?.data;
  const errors = raw?.errors;
  if (!errors || typeof errors !== "object" || Array.isArray(errors)) {
    return false;
  }
  const fields = [];
  for (const [name, val] of Object.entries(errors)) {
    if (name === "detail") continue;

    // Per-row child serializer errors. DRF emits one entry per row in the
    // request, with `{}` for rows that validated cleanly.
    const isNestedListErrors =
      Array.isArray(val) &&
      val.some((row) => row && typeof row === "object" && !Array.isArray(row));
    if (isNestedListErrors) {
      val.forEach((rowErrors, idx) => {
        if (
          !rowErrors ||
          typeof rowErrors !== "object" ||
          Array.isArray(rowErrors)
        ) {
          return;
        }
        for (const [inner, innerVal] of Object.entries(rowErrors)) {
          fields.push({
            name: [name, idx, inner],
            errors: (Array.isArray(innerVal) ? innerVal : [innerVal]).map(String),
          });
        }
      });
      continue;
    }

    fields.push({
      name,
      errors: (Array.isArray(val) ? val : [val]).map(String),
    });
  }
  if (fields.length) {
    form.setFields(fields);
    return true;
  }
  return false;
}

/**
 * Extract a flat list of message strings from DRF errors that aren't tied to a
 * specific input (`non_field_errors`, or top-level array-of-strings on a
 * container field like `variants` whose Form.List won't render the message
 * inline). Useful for surfacing as a toast alongside `applyDrfFieldErrors`.
 */
export function collectDrfSummaryErrors(error, { listFieldNames = [] } = {}) {
  const out = [];
  const raw = error?.response?.data;
  const errors = raw?.errors;
  if (!errors || typeof errors !== "object" || Array.isArray(errors)) {
    return out;
  }
  const listSet = new Set(listFieldNames);
  for (const [name, val] of Object.entries(errors)) {
    if (name === "detail") continue;
    if (name === "non_field_errors") {
      const items = Array.isArray(val) ? val : [val];
      for (const item of items) {
        if (item != null) out.push(String(item));
      }
      continue;
    }
    if (!listSet.has(name)) continue;
    // Container field with a flat string-array error (e.g. variants:
    // ["Duplicate variant SKUs in the request."]). Form.List has no place to
    // render this inline, so we surface it for the caller to toast.
    if (Array.isArray(val) && val.every((x) => typeof x === "string")) {
      for (const item of val) out.push(item);
    }
  }
  return out;
}
