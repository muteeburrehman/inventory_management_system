import { useState } from "react";
import { App, Button, Card, Descriptions, Input, Space, Typography } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { generateBarcode, lookupBarcode } from "../../api/barcodes.js";
import { PageShell } from "../../components/PageShell/PageShell.jsx";
import { formatCurrency } from "../../utils/currency.js";

export function BarcodesPage() {
  const { message } = App.useApp();
  const [code, setCode] = useState("");
  const [sku, setSku] = useState("");
  const [product, setProduct] = useState(null);
  const [generated, setGenerated] = useState(null);
  const [loading, setLoading] = useState(false);

  const onLookup = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setProduct(null);
    try {
      const res = await lookupBarcode(code.trim());
      if (res.found) {
        setProduct(res.product);
        message.success("Product found.");
      } else {
        message.info("No product with that barcode.");
      }
    } catch {
      message.error("Lookup failed.");
    } finally {
      setLoading(false);
    }
  };

  const onGenerate = async () => {
    if (!sku.trim()) return;
    setLoading(true);
    setGenerated(null);
    try {
      const res = await generateBarcode(sku.trim());
      setGenerated(res);
      message.success("Generated.");
    } catch {
      message.error("Generate failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell
      title="Barcode management"
      description="Resolve products from barcode and generate label values (PRD §9)."
      breadcrumb={[{ title: "Home", path: "/" }, { title: "Operations" }, { title: "Barcodes" }]}
    >
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <Card bordered={false} className="ims-card" title="Lookup">
          <Space.Compact style={{ maxWidth: 420 }}>
            <Input placeholder="Scan or enter barcode" value={code} onChange={(e) => setCode(e.target.value)} onPressEnter={onLookup} />
            <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={onLookup}>
              Lookup
            </Button>
          </Space.Compact>
          {product && (
            <Descriptions bordered size="small" column={1} style={{ marginTop: 20, maxWidth: 480 }}>
              <Descriptions.Item label="Name">{product.name}</Descriptions.Item>
              <Descriptions.Item label="SKU">{product.sku}</Descriptions.Item>
              <Descriptions.Item label="Stock">{product.current_stock}</Descriptions.Item>
              <Descriptions.Item label="Selling">{formatCurrency(product.selling_price)}</Descriptions.Item>
            </Descriptions>
          )}
        </Card>

        <Card bordered={false} className="ims-card" title="Generate">
          <Space.Compact style={{ maxWidth: 420 }}>
            <Input placeholder="SKU seed" value={sku} onChange={(e) => setSku(e.target.value)} onPressEnter={onGenerate} />
            <Button loading={loading} onClick={onGenerate}>
              Generate
            </Button>
          </Space.Compact>
          {generated && (
            <Typography.Paragraph style={{ marginTop: 16 }}>
              <Typography.Text code>{generated.barcode_value}</Typography.Text>
              <span style={{ marginLeft: 12 }} className="ant-typography-secondary">
                {generated.format}
              </span>
            </Typography.Paragraph>
          )}
        </Card>
      </Space>
    </PageShell>
  );
}
