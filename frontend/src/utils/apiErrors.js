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
 * @returns {boolean} true if field errors were applied
 */
export function applyDrfFieldErrors(form, error) {
  const raw = error?.response?.data;
  const errors = raw?.errors;
  if (!errors || typeof errors !== "object" || Array.isArray(errors)) {
    return false;
  }
  const fields = Object.entries(errors)
    .filter(([k]) => k !== "detail")
    .map(([name, val]) => ({
      name,
      errors: (Array.isArray(val) ? val : [val]).map(String),
    }));
  if (fields.length) {
    form.setFields(fields);
    return true;
  }
  return false;
}
