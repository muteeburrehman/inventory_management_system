/**
 * Ant Design Table `pagination` prop wired to DRF page numbers (1-based).
 */
export function antServerPagination({ page, pageSize, total, onChange }) {
  return {
    current: page,
    pageSize,
    total: total ?? 0,
    showSizeChanger: true,
    pageSizeOptions: [10, 25, 50, 100],
    showTotal: (t, range) => (t ? `${range[0]}-${range[1]} of ${t}` : "0 items"),
    onChange: (p, ps) => onChange(p, ps),
  };
}
