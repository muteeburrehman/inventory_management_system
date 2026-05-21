import { useEffect, useMemo, useRef, useState } from "react";
import {
  App,
  Button,
  Card,
  Col,
  Divider,
  Input,
  InputNumber,
  Modal,
  Pagination,
  Row,
  Select,
  Space,
  Table,
  Typography,
} from "antd";
import { MailOutlined, PlusOutlined } from "@ant-design/icons";
import { useZxing } from "react-zxing";
import { useReactToPrint } from "react-to-print";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createSale, holdSale, listHeldSales, validateCoupon } from "../../api/sales.js";
import { getSale, emailReceipt } from "../../api/salesApi.js";
import { listCustomers } from "../../api/customers.js";
import { searchProducts } from "../../api/products.js";
import { useCartStore } from "../../store/cartStore.js";
import { useAuthStore } from "../../store/authStore.js";
import { formatCurrency } from "../../utils/currency.js";
import { ThermalReceipt } from "../../components/PrintReceipt/ThermalReceipt.jsx";

const paymentModes = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "bank", label: "Bank transfer" },
  { value: "wallet", label: "Wallet" },
  { value: "credit", label: "Credit" },
  { value: "split", label: "Split payment" },
];

function buildSalePayload({ branchId, customerId, totals, couponCode, paymentMode, paidAmount, items, splitRows }) {
  const cartDiscount = totals.lineDiscount + totals.couponDiscount;
  const due = Math.max(totals.grandTotal - paidAmount, 0);
  const splits =
    paymentMode === "split"
      ? splitRows.filter((r) => r.amount > 0)
      : paidAmount > 0
        ? [{ payment_mode: paymentMode === "split" ? "cash" : paymentMode, amount: paidAmount }]
        : [];

  return {
    branch: branchId,
    customer: customerId || null,
    subtotal: totals.subtotal,
    discount: cartDiscount,
    tax: totals.tax,
    total_amount: totals.grandTotal,
    paid_amount: paidAmount,
    change_amount: Math.max(paidAmount - totals.grandTotal, 0),
    due_amount: due,
    payment_mode: paymentMode,
    status: "completed",
    notes: "",
    coupon_code: couponCode || "",
    items: items.map((i) => ({
      product: i.productId,
      variant: i.variantId,
      quantity: i.quantity,
      unit_price: i.unitPrice,
      discount: i.discount,
      tax: i.tax,
      subtotal: i.unitPrice * i.quantity + i.tax - i.discount,
    })),
    split_payments: splits,
  };
}

export function POSPage() {
  const { message } = App.useApp();
  const user = useAuthStore((s) => s.user);
  const printRef = useRef(null);
  const [query, setQuery] = useState("");
  const [paymentMode, setPaymentMode] = useState("cash");
  const [paidAmount, setPaidAmount] = useState(0);
  const [cameraOn, setCameraOn] = useState(false);
  const [lastInvoice, setLastInvoice] = useState(null);
  const [couponInput, setCouponInput] = useState("");
  const [splitRows, setSplitRows] = useState([
    { payment_mode: "cash", amount: 0 },
    { payment_mode: "card", amount: 0 },
  ]);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");

  const items = useCartStore((s) => s.items);
  const customerId = useCartStore((s) => s.customerId);
  const couponCode = useCartStore((s) => s.couponCode);
  const couponDiscount = useCartStore((s) => s.couponDiscount);
  const addItem = useCartStore((s) => s.addItem);
  const updateQty = useCartStore((s) => s.updateQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const setCustomer = useCartStore((s) => s.setCustomer);
  const setCoupon = useCartStore((s) => s.setCoupon);
  const setCouponDiscount = useCartStore((s) => s.setCouponDiscount);
  const loadFromSale = useCartStore((s) => s.loadFromSale);
  const resetCart = useCartStore((s) => s.reset);

  const branchId = user?.branch?.id;

  const totals = useMemo(() => {
    const subtotal = items.reduce((acc, i) => acc + Number(i.unitPrice) * Number(i.quantity), 0);
    const tax = items.reduce((acc, i) => acc + Number(i.tax || 0), 0);
    const lineDiscount = items.reduce((acc, i) => acc + Number(i.discount || 0), 0);
    const grandTotal = Math.max(subtotal + tax - lineDiscount - Number(couponDiscount || 0), 0);
    return { subtotal, tax, lineDiscount, couponDiscount: Number(couponDiscount || 0), grandTotal };
  }, [items, couponDiscount]);

  useEffect(() => {
    if (paymentMode !== "split") {
      setPaidAmount(totals.grandTotal);
    }
  }, [totals.grandTotal, paymentMode]);

  const custQ = useQuery({
    queryKey: ["customers", "pos"],
    queryFn: () => listCustomers({ page: 1, page_size: 200 }),
  });
  const customerOptions = (custQ.data?.results ?? []).map((c) => ({
    value: c.id,
    label: `${c.name}${c.phone ? ` · ${c.phone}` : ""}`,
  }));

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
      const taxPct = Number(p.tax_percent || 0);
      const lineTax = (unit * taxPct) / 100;
      addItem({
        key: `${p.id}-x`,
        productId: p.id,
        variantId: null,
        name: p.name,
        sku: p.sku,
        quantity: 1,
        unitPrice: unit,
        discount: Number(p.discount || 0),
        tax: lineTax,
        stock: p.current_stock,
      });
      message.success(`Added ${p.name}`);
      setQuery("");
    },
  });

  const couponMut = useMutation({
    mutationFn: () => validateCoupon(couponInput.trim(), totals.subtotal),
    onSuccess: (res) => {
      setCoupon(res.code);
      setCouponDiscount(Number(res.discount_amount));
      message.success(`Coupon applied: −${formatCurrency(res.discount_amount)}`);
    },
    onError: (e) => message.error(e?.response?.data?.message || "Invalid coupon."),
  });

  const paidForCheckout = useMemo(() => {
    if (paymentMode === "split") {
      return splitRows.reduce((a, r) => a + Number(r.amount || 0), 0);
    }
    return paidAmount;
  }, [paymentMode, paidAmount, splitRows]);

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!branchId) throw new Error("No branch on user profile.");
      if (paymentMode === "credit" && !customerId) {
        throw new Error("Select a customer for credit sales.");
      }
      if (paidForCheckout < totals.grandTotal && !customerId) {
        throw new Error("Select a customer when paid amount is less than total.");
      }
      return createSale(
        buildSalePayload({
          branchId,
          customerId,
          totals,
          couponCode,
          paymentMode,
          paidAmount: paidForCheckout,
          items,
          splitRows,
        }),
      );
    },
    onSuccess: (sale) => {
      message.success("Sale completed.");
      setLastInvoice(sale);
      resetCart();
      setCouponInput("");
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
        ...buildSalePayload({
          branchId,
          customerId,
          totals,
          couponCode,
          paymentMode: "cash",
          paidAmount: 0,
          items,
          splitRows: [],
        }),
        status: "held",
        due_amount: totals.grandTotal,
      });
    },
    onSuccess: () => {
      message.success("Invoice held.");
      resetCart();
    },
    onError: (e) => message.error(e?.response?.data?.message || "Hold failed."),
  });

  const emailMut = useMutation({
    mutationFn: () => emailReceipt(lastInvoice.id, emailTo),
    onSuccess: () => {
      message.success("Receipt emailed.");
      setEmailOpen(false);
    },
    onError: (e) => message.error(e?.response?.data?.detail || "Email failed."),
  });

  const [heldPage, setHeldPage] = useState(1);
  const [heldPageSize, setHeldPageSize] = useState(25);

  const { data: heldData, refetch: refetchHeld } = useQuery({
    queryKey: ["held-sales", heldPage, heldPageSize],
    queryFn: () => listHeldSales({ page: heldPage, page_size: heldPageSize }),
  });
  const held = heldData?.results ?? [];

  const resumeHeld = async (saleId) => {
    try {
      const sale = await getSale(saleId);
      loadFromSale(sale);
      message.success(`Loaded ${sale.invoice_number} into cart.`);
    } catch {
      message.error("Could not load held sale.");
    }
  };

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
    <div style={{ maxWidth: 1400 }} className="pos-page">
      <Typography.Title level={2} style={{ fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 8 }}>
        POS / Billing
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 20 }}>
        Search, scan, customer, coupons, split payments, hold/resume, print &amp; email receipts.
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
                placeholder="Resume held sale"
                options={held.map((h) => ({ value: h.id, label: h.invoice_number }))}
                onChange={(id) => id && resumeHeld(id)}
                allowClear
              />
              <Pagination
                size="small"
                current={heldPage}
                pageSize={heldPageSize}
                total={heldData?.count ?? 0}
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
          <Card title="Customer &amp; coupons">
            <Space direction="vertical" style={{ width: "100%" }}>
              <Select
                allowClear
                showSearch
                placeholder="Customer (required for credit / partial pay)"
                style={{ width: "100%" }}
                value={customerId}
                onChange={setCustomer}
                options={customerOptions}
                optionFilterProp="label"
              />
              <Space.Compact style={{ width: "100%" }}>
                <Input
                  placeholder="Coupon code"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                />
                <Button onClick={() => couponMut.mutate()} loading={couponMut.isPending}>
                  Apply
                </Button>
              </Space.Compact>
              {couponCode ? (
                <Typography.Text type="success">
                  Coupon {couponCode}: −{formatCurrency(couponDiscount)}
                </Typography.Text>
              ) : null}
            </Space>
          </Card>
          <Card title="Payment" style={{ marginTop: 16 }}>
            <Space direction="vertical" style={{ width: "100%" }}>
              <div>Subtotal: {formatCurrency(totals.subtotal)}</div>
              <div>Tax: {formatCurrency(totals.tax)}</div>
              <div>Line discount: {formatCurrency(totals.lineDiscount)}</div>
              {totals.couponDiscount > 0 && (
                <div>Coupon: −{formatCurrency(totals.couponDiscount)}</div>
              )}
              <Typography.Title level={4}>Total: {formatCurrency(totals.grandTotal)}</Typography.Title>
              <Select
                style={{ width: "100%" }}
                value={paymentMode}
                onChange={setPaymentMode}
                options={paymentModes}
              />
              {paymentMode === "split" ? (
                <>
                  {splitRows.map((row, idx) => (
                    <Space key={idx} style={{ width: "100%" }}>
                      <Select
                        style={{ width: 120 }}
                        value={row.payment_mode}
                        onChange={(v) => {
                          const next = [...splitRows];
                          next[idx] = { ...next[idx], payment_mode: v };
                          setSplitRows(next);
                        }}
                        options={paymentModes.filter((m) => m.value !== "split" && m.value !== "credit")}
                      />
                      <InputNumber
                        style={{ flex: 1 }}
                        min={0}
                        value={row.amount}
                        onChange={(v) => {
                          const next = [...splitRows];
                          next[idx] = { ...next[idx], amount: Number(v || 0) };
                          setSplitRows(next);
                        }}
                      />
                    </Space>
                  ))}
                  <Button
                    type="dashed"
                    icon={<PlusOutlined />}
                    onClick={() => setSplitRows([...splitRows, { payment_mode: "cash", amount: 0 }])}
                  >
                    Add split line
                  </Button>
                  <div>Split total: {formatCurrency(paidForCheckout)}</div>
                </>
              ) : (
                <div>
                  <Typography.Text>Paid</Typography.Text>
                  <InputNumber
                    style={{ width: "100%", marginTop: 8 }}
                    min={0}
                    value={paidAmount}
                    onChange={(v) => setPaidAmount(Number(v || 0))}
                  />
                </div>
              )}
              {paymentMode === "cash" && (
                <div>Change: {formatCurrency(Math.max(paidForCheckout - totals.grandTotal, 0))}</div>
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
              <Button
                block
                disabled={!lastInvoice}
                icon={<MailOutlined />}
                onClick={() => setEmailOpen(true)}
              >
                Email receipt
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>
      <Modal
        title="Email receipt"
        open={emailOpen}
        onCancel={() => setEmailOpen(false)}
        onOk={() => emailMut.mutate()}
        confirmLoading={emailMut.isPending}
      >
        <Input
          placeholder="customer@email.com"
          value={emailTo}
          onChange={(e) => setEmailTo(e.target.value)}
        />
      </Modal>
      <div style={{ position: "absolute", left: -9999, top: 0 }}>
        <ThermalReceipt ref={printRef} sale={lastInvoice} />
      </div>
    </div>
  );
}
