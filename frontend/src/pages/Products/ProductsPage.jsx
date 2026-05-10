import { App, Button, Card, Space, Table, Tag, Typography } from "antd";
import { DeleteOutlined, EyeOutlined, PlusOutlined, ShoppingOutlined, EditOutlined } from "@ant-design/icons";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { deleteProduct, listProducts } from "../../api/products.js";
import { ConfirmDeleteButton } from "../../components/ConfirmDeleteButton.jsx";
import { PageShell } from "../../components/PageShell/PageShell.jsx";
import { formatCurrency } from "../../utils/currency.js";
import { antServerPagination } from "../../utils/serverPagination.js";

export function ProductsPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data: pageData, isLoading } = useQuery({
    queryKey: ["products", "list", page, pageSize],
    queryFn: () => listProducts({ page, page_size: pageSize }),
  });

  const delMutation = useMutation({
    mutationFn: (pid) => deleteProduct(pid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      message.success("Product deleted.");
    },
    onError: (e) => message.error(e?.response?.data?.message || "Delete failed."),
  });

  const rows = pageData?.results ?? [];
  const total = pageData?.count ?? 0;

  const columns = [
    { title: "Name", dataIndex: "name", key: "name", ellipsis: true },
    { title: "SKU", dataIndex: "sku", key: "sku", width: 120 },
    { title: "Barcode", dataIndex: "barcode", key: "barcode", width: 120, render: (b) => b || "—" },
    {
      title: "Category",
      key: "cat",
      width: 140,
      ellipsis: true,
      render: (_, r) =>
        r.category?.parent_name ? `${r.category.parent_name} › ${r.category.name}` : (r.category?.name ?? "—"),
    },
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
    {
      title: "",
      key: "actions",
      width: 200,
      render: (_, r) => (
        <Space size="small" wrap={false}>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/products/${r.id}`)}>
            View
          </Button>
          <Link to={`/products/${r.id}/edit`}>
            <Button type="link" size="small" icon={<EditOutlined />}>
              Edit
            </Button>
          </Link>
          <ConfirmDeleteButton
            title="Delete this product?"
            onConfirm={() => delMutation.mutateAsync(r.id)}
            icon={<DeleteOutlined />}
            loading={delMutation.isPending}
          >
            Delete
          </ConfirmDeleteButton>
        </Space>
      ),
    },
  ];

  return (
    <PageShell
      title="Products"
      description="Product master: SKU, barcode, category, pricing, GST, and variants."
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
          <Link to="/products/create">
            <Button type="primary" icon={<PlusOutlined />}>
              Add product
            </Button>
          </Link>
        }
      >
        <Table
          rowKey="id"
          loading={isLoading}
          columns={columns}
          dataSource={rows}
          scroll={{ x: 960 }}
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
