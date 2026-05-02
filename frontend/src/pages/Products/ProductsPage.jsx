import { Button, Card, Space, Table, Tag, Typography } from "antd";
import { PlusOutlined, ShoppingOutlined } from "@ant-design/icons";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listProducts } from "../../api/products.js";
import { PageShell } from "../../components/PageShell/PageShell.jsx";
import { formatCurrency } from "../../utils/currency.js";
import { antServerPagination } from "../../utils/serverPagination.js";

export function ProductsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data: pageData, isLoading } = useQuery({
    queryKey: ["products", "list", page, pageSize],
    queryFn: () => listProducts({ page, page_size: pageSize }),
  });

  const rows = pageData?.results ?? [];
  const total = pageData?.count ?? 0;

  const columns = [
    { title: "Name", dataIndex: "name", key: "name", ellipsis: true },
    { title: "SKU", dataIndex: "sku", key: "sku", width: 120 },
    { title: "Barcode", dataIndex: "barcode", key: "barcode", width: 130 },
    {
      title: "Stock",
      dataIndex: "current_stock",
      key: "stock",
      width: 90,
      render: (v) => (v <= 0 ? <Tag color="error">{v}</Tag> : v),
    },
    {
      title: "Selling",
      dataIndex: "selling_price",
      key: "sell",
      width: 120,
      render: (v) => formatCurrency(v),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (s) => <Tag color={s === "active" ? "green" : "default"}>{s}</Tag>,
    },
  ];

  return (
    <PageShell
      title="Products"
      description="Manage catalog items: SKU, barcode, pricing, stock, and variants (PRD §2)."
      breadcrumb={[
        { title: "Home", path: "/" },
        { title: "Catalog", path: "/products" },
        { title: "Products" },
      ]}
    >
      <Card
        bordered={false}
        className="ims-card"
        title={
          <Space>
            <ShoppingOutlined />
            <span>Product list</span>
            <Typography.Text type="secondary">({total} items)</Typography.Text>
          </Space>
        }
        extra={
          <Button type="primary" icon={<PlusOutlined />} disabled>
            Add product
          </Button>
        }
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          Full create/edit forms hook to{" "}
          <Typography.Text code>POST /api/v1/products/</Typography.Text> — scaffolded next.
        </Typography.Paragraph>
        <Table
          rowKey="id"
          loading={isLoading}
          columns={columns}
          dataSource={rows}
          pagination={antServerPagination({
            page,
            pageSize,
            total,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          })}
        />
        <div style={{ marginTop: 16 }}>
          <Link to="/pos">
            <Button type="link">Open POS →</Button>
          </Link>
        </div>
      </Card>
    </PageShell>
  );
}
