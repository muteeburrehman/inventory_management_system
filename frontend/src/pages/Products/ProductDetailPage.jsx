import { App, Button, Card, Descriptions, Space, Table, Tag, Typography } from "antd";
import { EditOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deleteProduct, deleteProductVariant, getProduct } from "../../api/products.js";
import { ConfirmDeleteButton } from "../../components/ConfirmDeleteButton.jsx";
import { PageShell } from "../../components/PageShell/PageShell.jsx";
import { envelopeMessage } from "../../utils/apiErrors.js";
import { formatCurrency } from "../../utils/currency.js";

export function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const qc = useQueryClient();

  const { data: product, isLoading } = useQuery({
    queryKey: ["products", id],
    queryFn: () => getProduct(id),
  });

  const delProduct = useMutation({
    mutationFn: () => deleteProduct(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      message.success("Product deleted.");
      navigate("/products");
    },
    onError: (e) => message.error(envelopeMessage(e)),
  });

  const delVariant = useMutation({
    mutationFn: (variantId) => deleteProductVariant(id, variantId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products", id] });
      message.success("Variant removed.");
    },
    onError: (e) => message.error(envelopeMessage(e)),
  });

  const cat = product?.category;
  const categoryLine = cat
    ? cat.parent_name
      ? `${cat.parent_name} › ${cat.name}`
      : cat.name
    : "—";

  return (
    <PageShell
      title={product?.name || "Product"}
      description="View master data and variants."
      breadcrumb={[
        { title: "Home", path: "/" },
        { title: "Products", path: "/products" },
        { title: product?.name || "Detail" },
      ]}
    >
      <Card bordered={false} className="ims-card" loading={isLoading}>
        {product ? (
          <>
            <Space wrap style={{ marginBottom: 16 }}>
              <Link to="/products">
                <Button icon={<ArrowLeftOutlined />}>Back to list</Button>
              </Link>
              <Link to={`/products/${id}/edit`}>
                <Button type="primary" icon={<EditOutlined />}>
                  Edit
                </Button>
              </Link>
              <ConfirmDeleteButton
                title="Delete this product?"
                description="Linked sales/purchases keep history; variants are removed."
                onConfirm={() => delProduct.mutateAsync()}
                loading={delProduct.isPending}
                type="default"
                size="middle"
              >
                Delete product
              </ConfirmDeleteButton>
            </Space>

            <Descriptions bordered size="small" column={{ xs: 1, md: 2 }}>
              <Descriptions.Item label="SKU">{product.sku}</Descriptions.Item>
              <Descriptions.Item label="Barcode">{product.barcode || "—"}</Descriptions.Item>
              <Descriptions.Item label="Category">{categoryLine}</Descriptions.Item>
              <Descriptions.Item label="Brand">{product.brand?.name ?? "—"}</Descriptions.Item>
              <Descriptions.Item label="Unit">{product.unit_type}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={product.status === "active" ? "green" : "default"}>{product.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Cost price">{formatCurrency(product.purchase_price)}</Descriptions.Item>
              <Descriptions.Item label="Selling price">{formatCurrency(product.selling_price)}</Descriptions.Item>
              <Descriptions.Item label="Wholesale">{formatCurrency(product.wholesale_price)}</Descriptions.Item>
              <Descriptions.Item label="GST %">{product.tax_percent}%</Descriptions.Item>
              <Descriptions.Item label="Discount %">{product.discount}%</Descriptions.Item>
              <Descriptions.Item label="Current stock">{product.current_stock}</Descriptions.Item>
              <Descriptions.Item label="Min stock alert">{product.min_stock_level}</Descriptions.Item>
            </Descriptions>

            <Typography.Title level={5} style={{ marginTop: 24 }}>
              Description
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ whiteSpace: "pre-wrap" }}>
              {product.description || "—"}
            </Typography.Paragraph>

            <Typography.Title level={5} style={{ marginTop: 24 }}>
              Variants
            </Typography.Title>
            <Table
              size="small"
              rowKey="id"
              dataSource={product.variants ?? []}
              pagination={false}
              columns={[
                { title: "Size", dataIndex: "size", render: (t) => t || "—" },
                { title: "Color", dataIndex: "color", render: (t) => t || "—" },
                { title: "Weight", dataIndex: "weight", render: (t) => t ?? "—" },
                { title: "Volume", dataIndex: "volume", render: (t) => t ?? "—" },
                { title: "Variant SKU", dataIndex: "sku" },
                { title: "Price ±", dataIndex: "price_modifier", render: (v) => formatCurrency(v) },
                { title: "Stock", dataIndex: "stock" },
                {
                  title: "",
                  width: 100,
                  render: (_, row) =>
                    row.id ? (
                      <ConfirmDeleteButton
                        title="Remove this variant?"
                        onConfirm={() => delVariant.mutateAsync(row.id)}
                        loading={delVariant.isPending}
                      >
                        Remove
                      </ConfirmDeleteButton>
                    ) : null,
                },
              ]}
            />
          </>
        ) : (
          !isLoading && (
            <Typography.Text type="secondary">Product not found.</Typography.Text>
          )
        )}
      </Card>
    </PageShell>
  );
}
