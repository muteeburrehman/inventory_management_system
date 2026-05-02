import { Card, Table, Tag } from "antd";
import { FolderOutlined } from "@ant-design/icons";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listCategories } from "../../api/products.js";
import { PageShell } from "../../components/PageShell/PageShell.jsx";
import { antServerPagination } from "../../utils/serverPagination.js";

export function CategoriesPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data: pageData, isLoading } = useQuery({
    queryKey: ["categories", page, pageSize],
    queryFn: () => listCategories({ page, page_size: pageSize }),
  });
  const rows = pageData?.results ?? [];
  const total = pageData?.count ?? 0;

  return (
    <PageShell
      title="Categories"
      description="Parent and child categories for merchandising (PRD §3)."
      breadcrumb={[{ title: "Home", path: "/" }, { title: "Catalog", path: "/products" }, { title: "Categories" }]}
    >
      <Card bordered={false} title={<FolderOutlined />}>
        <Table
          rowKey="id"
          loading={isLoading}
          pagination={antServerPagination({
            page,
            pageSize,
            total,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          })}
          dataSource={rows}
          columns={[
            { title: "Name", dataIndex: "name" },
            { title: "Slug", dataIndex: "slug" },
            { title: "Parent ID", dataIndex: "parent", render: (p) => p ?? <Tag>—</Tag> },
          ]}
        />
      </Card>
    </PageShell>
  );
}
