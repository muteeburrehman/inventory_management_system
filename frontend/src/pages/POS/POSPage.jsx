import { useMemo, useRef, useState } from "react";
import {
  App,
  Button,
  Card,
  Col,
  Divider,
  Input,
  InputNumber,
  Pagination,
  Row,
  Select,
  Space,
  Table,
  Typography,
} from "antd";
import { useZxing } from "react-zxing";
import { useReactToPrint } from "react-to-print";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createSale, holdSale, listHeldSales } from "../../api/sales.js";
import { searchProducts } from "../../api/products.js";
import { useCartStore } from "../../store/cartStore.js";
import { useAuthStore } from "../../store/authStore.js";
import { formatCurrency } from "../../utils/currency.js";
import { ThermalReceipt } from "../../components/PrintReceipt/ThermalReceipt.jsx";

const paymentModes = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "wallet", label: "Wallet" },
  { value: "credit", label: "Credit" },
  { value: "split", label: "Split" },
];

export function POSPage() {
  const { message } = App.useApp();
  const user = useAuthStore((s) => s.user);
  const printRef = useRef(null);
  const [query, setQuery] = useState("");
  const [paymentMode, setPaymentMode] = useState("cash");
  const [paidAmount, setPaidAmount] = useState(0);
  const [cameraOn, setCameraOn] = useState(false);
  const [lastInvoice, setLastInvoice] = useState(null);

  const items = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const updateQty = useCartStore((s) => s.updateQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const resetCart = useCartStore((s) => s.reset);

  const branchId = user?.branch?.id;

  const totals = useMemo(() => {
    const subtotal = items.reduce((acc, i) => acc + Number(i.unitPrice) * Number(i.quantity), 0);
    const tax = items.reduce((acc, i) => acc + Number(i.tax || 0), 0);
    const discount = items.reduce((acc, i) => acc + Number(i.discount || 0), 0);
    const total = Math.max(subtotal + tax - discount, 0);
    return { subtotal, tax, discount, total };
  }, [items]);

  const { ref: zxingRef } = useZxing({
    paused: !cameraOn,
    onDecodeResult(result) {
      setQuery(result.getText());
      message.success(`Scanned: ${result.getText()}`);
    },
  });


  const searchMutation = useMutation({
    mutationFn: async () => {
      const rows = await searchProducts({ q: query, barcode: query });
      return Array.isArray(rows) ? rows : rows?.results ?? [];
    },
    onSuccess: (rows) => {
      if (!rows?.length) {
        message.warning("No product found.");
        return;
      }
      const p = rows[0];
      const unit = Number(p.selling_price);
      addItem({
        key: `${p.id}-x`,
        productId: p.id,
        variantId: null,
        name: p.name,
        sku: p.sku,
        quantity: 1,
        unitPrice: unit,
        discount: 0,
        tax: 0,
        stock: p.current_stock,
      });
      message.success(`Added ${p.name}`);
      setQuery("");
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!branchId) throw new Error("No branch on user profile.");
      const payload = {
        branch: branchId,
        customer: null,
        subtotal: totals.subtotal,
        discount: totals.discount,
        tax: totals.tax,
        total_amount: totals.total,
        paid_amount: paidAmount,
        change_amount: Math.max(paidAmount - totals.total, 0),
        due_amount: Math.max(totals.total - paidAmount, 0),
        payment_mode: paymentMode,
        status: "completed",
        notes: "",
        items: items.map((i) => ({
          product: i.productId,
          variant: i.variantId,
          quantity: i.quantity,
          unit_price: i.unitPrice,
          discount: i.discount,
          tax: i.tax,
          subtotal: i.unitPrice * i.quantity + i.tax - i.discount,
        })),
        split_payments: [],
      };
      return createSale(payload);
    },
    onSuccess: (sale) => {
      message.success("Sale completed.");
      setLastInvoice(sale);
      resetCart();
      setPaidAmount(0);
    },
    onError: (e) => {
      message.error(e?.response?.data?.message || e.message || "Checkout failed.");
    },
  });

  const holdMutation = useMutation({
    mutationFn: async () => {
      if (!branchId) throw new Error("No branch on user profile.");
      return holdSale({
        branch: branchId,
        customer: null,
        subtotal: totals.subtotal,
        discount: totals.discount,
        tax: totals.tax,
        total_amount: totals.total,
        paid_amount: 0,
        change_amount: 0,
        due_amount: totals.total,
        payment_mode: "cash",
        status: "held",
        notes: "held",
        items: items.map((i) => ({
          product: i.productId,
          variant: i.variantId,
          quantity: i.quantity,
          unit_price: i.unitPrice,
          discount: i.discount,
          tax: i.tax,
          subtotal: i.unitPrice * i.quantity + i.tax - i.discount,
        })),
        split_payments: [],
      });
    },
    onSuccess: () => {
      message.success("Invoice held.");
      resetCart();
    },
    onError: (e) => message.error(e?.response?.data?.message || "Hold failed."),
  });

  const [heldPage, setHeldPage] = useState(1);
  const [heldPageSize, setHeldPageSize] = useState(25);

  const { data: heldData } = useQuery({
    queryKey: ["held-sales", heldPage, heldPageSize],
    queryFn: () => listHeldSales({ page: heldPage, page_size: heldPageSize }),
  });
  const held = heldData?.results ?? [];

  const handlePrint = useReactToPrint({ contentRef: printRef });

  const columns = [
    { title: "Item", dataIndex: "name", key: "name" },
    { title: "SKU", dataIndex: "sku", key: "sku" },
    {
      title: "Qty",
      dataIndex: "quantity",
      key: "quantity",
      render: (_, row) => (
        <InputNumber min={1} value={row.quantity} onChange={(v) => updateQty(row.key, v || 1)} />
      ),
    },
    {
      title: "Price",
      key: "unitPrice",
      render: (_, row) => formatCurrency(row.unitPrice),
    },
    {
      title: "",
      key: "rm",
      render: (_, row) => (
        <Button type="link" danger onClick={() => removeItem(row.key)}>
          Remove
        </Button>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1400 }}>
      <Typography.Title level={2} style={{ fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 8 }}>
        POS / Billing
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 20 }}>
        Search or scan · cart · customer · coupons · hold · split pay · thermal / A4 print (PRD §7).
      </Typography.Paragraph>
      <Row gutter={16}>
        <Col xs={24} lg={14}>
          <Card title="Products">
            <Space direction="vertical" style={{ width: "100%" }}>
              <Input.Search
                placeholder="Search SKU, name, or scan barcode + Enter"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onSearch={() => searchMutation.mutate()}
                onPressEnter={() => searchMutation.mutate()}
                enterButton
                loading={searchMutation.isPending}
                autoFocus
              />
              <Space>
                <Button onClick={() => setCameraOn((v) => !v)}>
                  {cameraOn ? "Stop camera" : "Camera scan"}
                </Button>
                {cameraOn && (
                  <video ref={zxingRef} style={{ width: 240, borderRadius: 8 }} muted playsInline />
                )}
              </Space>
              <Divider />
              <Typography.Text type="secondary">Held invoices</Typography.Text>
              <Select
                style={{ width: "100%" }}
                placeholder="Resume held sale (load items manually for now)"
                options={held.map((h) => ({ value: h.id, label: h.invoice_number }))}
              />
              <Pagination
                size="small"
                style={{ marginTop: 8 }}
                current={heldPage}
                pageSize={heldPageSize}
                total={heldData?.count ?? 0}
                showSizeChanger
                pageSizeOptions={[10, 25, 50]}
                onChange={(p, ps) => {
                  setHeldPage(p);
                  setHeldPageSize(ps);
                }}
              />
            </Space>
          </Card>
          <Card title="Cart" style={{ marginTop: 16 }}>
            <Table rowKey="key" columns={columns} dataSource={items} pagination={false} />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="Payment">
            <Space direction="vertical" style={{ width: "100%" }}>
              <div>Subtotal: {formatCurrency(totals.subtotal)}</div>
              <div>Tax: {formatCurrency(totals.tax)}</div>
              <div>Discount: {formatCurrency(totals.discount)}</div>
              <Typography.Title level={4}>Total: {formatCurrency(totals.total)}</Typography.Title>
              <Select
                style={{ width: "100%" }}
                value={paymentMode}
                onChange={setPaymentMode}
                options={paymentModes}
              />
              <div>
                <Typography.Text>Paid</Typography.Text>
                <InputNumber
                  style={{ width: "100%", marginTop: 8 }}
                  min={0}
                  value={paidAmount}
                  onChange={(v) => setPaidAmount(Number(v || 0))}
                />
              </div>
              {paymentMode === "cash" && (
                <div>Change: {formatCurrency(Math.max(paidAmount - totals.total, 0))}</div>
              )}
              <Button type="primary" block disabled={!items.length} onClick={() => checkoutMutation.mutate()}>
                Checkout
              </Button>
              <Button block disabled={!items.length} onClick={() => holdMutation.mutate()}>
                Hold invoice
              </Button>
              <Button block disabled={!lastInvoice} onClick={() => handlePrint()}>
                Print last receipt
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>
      <div style={{ position: "absolute", left: -9999, top: 0 }}>
        <ThermalReceipt ref={printRef} sale={lastInvoice} />
      </div>
    </div>
  );
}
