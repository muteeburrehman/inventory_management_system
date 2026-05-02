export function unwrap(data) {
  return data?.data ?? data;
}

/**
 * Normalize any list API response after envelope unwrap:
 * - DRF page: { count, next, previous, results }
 * - Raw array (custom actions): treat as one page
 */
export function normalizePaged(responseBody) {
  const inner = unwrap(responseBody);
  if (inner == null) {
    return { results: [], count: 0, next: null, previous: null };
  }
  if (Array.isArray(inner)) {
    return { results: inner, count: inner.length, next: null, previous: null };
  }
  const results = Array.isArray(inner.results) ? inner.results : [];
  const count = typeof inner.count === "number" ? inner.count : results.length;
  return {
    results,
    count,
    next: inner.next ?? null,
    previous: inner.previous ?? null,
  };
}

/** @deprecated use normalizePaged().results when you only need rows */
export function asList(payload) {
  return normalizePaged(payload).results;
}
