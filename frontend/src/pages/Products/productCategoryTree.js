/**
 * Build cascader nodes from flat /categories/ responses (each row: id, name, parent, slug).
 */
export function cascaderCategoryOptions(categories = []) {
  const byParent = new Map();
  for (const c of categories) {
    const pid = c.parent ?? null;
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid).push(c);
  }
  function mk(parentId) {
    const rows = byParent.get(parentId) || [];
    return rows
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => {
        const kids = mk(c.id);
        const opt = { value: c.id, label: c.name };
        if (kids.length) opt.children = kids;
        return opt;
      });
  }
  return mk(null);
}

/** Path array [ancestorId, ..., categoryId] for Ant Design Cascader */
export function categoryPathForId(categoryId, categories = []) {
  if (categoryId == null) return [];
  const path = [];
  let curId = categoryId;
  while (curId != null) {
    const row = categories.find((c) => c.id === curId);
    if (!row) break;
    path.unshift(row.id);
    curId = row.parent ?? null;
  }
  return path;
}
