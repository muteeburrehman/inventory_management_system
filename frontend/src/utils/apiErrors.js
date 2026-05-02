/**
 * Read error text from our DRF envelope handler or plain Django/DRF bodies.
 */
export function envelopeMessage(error) {
  const d = error?.response?.data;
  if (d && typeof d.message === "string" && d.message) {
    return d.message;
  }
  if (d && typeof d.detail === "string") {
    return d.detail;
  }
  if (Array.isArray(d) && d.length && typeof d[0] === "string") {
    return d[0];
  }
  if (error?.message) {
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
