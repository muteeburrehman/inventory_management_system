import { useEffect, useRef, useState } from "react";
import { App, Button, Card, Descriptions, Input, Space, Typography } from "antd";
import { PrinterOutlined, SearchOutlined } from "@ant-design/icons";
import JsBarcode from "jsbarcode";
import { useReactToPrint } from "react-to-print";
import { generateBarcode, lookupBarcode } from "../../api/barcodes.js";
import { PageShell } from "../../components/PageShell/PageShell.jsx";
import { formatCurrency } from "../../utils/currency.js";

function BarcodeLabel({ value }) {
  const svgRef = useRef(null);
  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, { format: "CODE128", displayValue: true, width: 2, height: 80 });
      } catch {
        /* skip invalid */
      }
    }
  }, [value]);
  return value ? <svg ref={svgRef} /> : null;
}

export function BarcodesPage() {
  const { message } = App.useApp();
  const [code, setCode] = useState("");
  const [sku, setSku] = useState("");
  const [product, setProduct] = useState(null);
  const [generated, setGenerated] = useState(null);
  const [loading, setLoading] = useState(false);
  const printRef = useRef(null);

  const printValue = generated?.barcode_value || product?.barcode || "";

  const handlePrint = useReactToPrint({ contentRef: printRef });

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
      description="Lookup products by barcode, generate label values, and print CODE128 labels."
      breadcrumb={[{ title: "Home", path: "/" }, { title: "Operations" }, { title: "Barcodes" }]}
    >
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <Card bordered={false} className="ims-card" title="Lookup">
          <Space.Compact style={{ maxWidth: 420 }}>
            <Input
              placeholder="Scan or enter barcode"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onPressEnter={onLookup}
            />
            <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={onLookup}>
              Lookup
            </Button>
          </Space.Compact>
          {product && (
            <Descriptions bordered size="small" column={1} style={{ marginTop: 20, maxWidth: 480 }}>
              <Descriptions.Item label="Name">{product.name}</Descriptions.Item>
              <Descriptions.Item label="SKU">{product.sku}</Descriptions.Item>
              <Descriptions.Item label="Barcode">{product.barcode || "—"}</Descriptions.Item>
              <Descriptions.Item label="Stock">{product.current_stock}</Descriptions.Item>
              <Descriptions.Item label="Selling">{formatCurrency(product.selling_price)}</Descriptions.Item>
            </Descriptions>
          )}
        </Card>

        <Card bordered={false} className="ims-card" title="Generate &amp; print">
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
          {printValue && (
            <div style={{ marginTop: 24 }}>
              <BarcodeLabel value={printValue} />
              <Button icon={<PrinterOutlined />} style={{ marginTop: 12 }} onClick={() => handlePrint()}>
                Print label
              </Button>
            </div>
          )}
        </Card>
      </Space>
      <div style={{ position: "absolute", left: -9999, top: 0 }}>
        <div ref={printRef} style={{ padding: 16, textAlign: "center" }}>
          <BarcodeLabel value={printValue} />
          <Typography.Paragraph>{printValue}</Typography.Paragraph>
        </div>
      </div>
    </PageShell>
  );
}
