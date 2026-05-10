import {
  App,
  Button,
  Card,
  Cascader,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Typography,
} from "antd";
import { MinusCircleOutlined, PlusOutlined, SaveOutlined } from "@ant-design/icons";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  createProduct,
  getProduct,
  listBrands,
  listCategories,
  updateProduct,
} from "../../api/products.js";
import { PageShell } from "../../components/PageShell/PageShell.jsx";
import { applyDrfFieldErrors, envelopeMessage } from "../../utils/apiErrors.js";
import { cascaderCategoryOptions, categoryPathForId } from "./productCategoryTree.js";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

function newVariantRow() {
  return {
    key: globalThis.crypto?.randomUUID?.() ?? String(Date.now()),
    id: undefined,
    size: "",
    color: "",
    weight: 0,
    volume: 0,
    sku: "",
    price_modifier: 0,
    stock: 0,
  };
}

export function ProductFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [form] = Form.useForm();
  const isEdit = Boolean(id);

  const { data: categoriesPg } = useQuery({
    queryKey: ["categories", "product-form"],
    queryFn: () => listCategories({ page_size: 100 }),
  });
  const categories = categoriesPg?.results ?? [];

  const { data: brandsPg } = useQuery({
    queryKey: ["brands", "product-form"],
    queryFn: () => listBrands({ page_size: 100 }),
  });
  const brands = brandsPg?.results ?? [];

  const { data: product, isLoading: loadingProduct } = useQuery({
    queryKey: ["products", id],
    queryFn: () => getProduct(id),
    enabled: isEdit,
  });

  useEffect(() => {
    if (!product || !isEdit) return;
    const cascaderVal = categoryPathForId(product.category?.id, categories);
    const variantsSrc = product.variants?.length ? product.variants : [{ sku: "", size: "" }];
    const variants = variantsSrc.map((v, i) => ({
      key: v.id ? `v-${v.id}` : `new-${i}`,
      id: v.id,
      size: v.size || "",
      color: v.color || "",
      weight: v.weight ?? 0,
      volume: v.volume ?? 0,
      sku: v.sku || "",
      price_modifier: v.price_modifier ?? 0,
      stock: v.stock ?? 0,
    }));
    form.setFieldsValue({
      name: product.name,
      sku: product.sku,
      barcode: product.barcode || undefined,
      category_cascade: cascaderVal.length ? cascaderVal : undefined,
      brand: product.brand?.id ?? undefined,
      description: product.description || "",
      unit_type: product.unit_type || "pcs",
      purchase_price: product.purchase_price,
      selling_price: product.selling_price,
      wholesale_price: product.wholesale_price,
      tax_percent: product.tax_percent,
      discount: product.discount,
      min_stock_level: product.min_stock_level,
      opening_stock: product.opening_stock,
      current_stock: product.current_stock,
      status: product.status || "active",
      variants,
    });
  }, [product, isEdit, form, categories]);

  const cascaderOpts = cascaderCategoryOptions(categories);

  const createMut = useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      message.success("Product created.");
      navigate("/products");
    },
    onError: (err) => {
      if (!applyDrfFieldErrors(form, err)) message.error(envelopeMessage(err));
    },
  });

  const updateMut = useMutation({
    mutationFn: (body) => updateProduct(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["products", id] });
      message.success("Product updated.");
      navigate(`/products/${id}`);
    },
    onError: (err) => {
      if (!applyDrfFieldErrors(form, err)) message.error(envelopeMessage(err));
    },
  });

  const onFinish = (values) => {
    const path = values.category_cascade;
    const categoryId = Array.isArray(path) ? path[path.length - 1] : path;
    if (categoryId == null) {
      message.error("Select a category (and sub-category if applicable).");
      return;
    }
    const variantsIn = Array.isArray(values.variants) ? values.variants : [];
    const variants = variantsIn
      .filter((row) => (row?.sku || "").trim())
      .map((row) => {
        const v = {
          size: (row.size || "").trim(),
          color: (row.color || "").trim(),
          weight: row.weight ?? 0,
          volume: row.volume ?? 0,
          sku: (row.sku || "").trim(),
          price_modifier: row.price_modifier ?? 0,
          stock: row.stock ?? 0,
        };
        if (row.id != null && row.id !== "") v.id = row.id;
        return v;
      });

    const body = {
      name: values.name.trim(),
      sku: values.sku.trim(),
      barcode:
        values.barcode != null && String(values.barcode).trim() !== ""
          ? String(values.barcode).trim()
          : null,
      category: categoryId,
      brand: values.brand ?? null,
      description: (values.description || "").trim(),
      unit_type: (values.unit_type || "pcs").trim(),
      purchase_price: values.purchase_price ?? 0,
      selling_price: values.selling_price ?? 0,
      wholesale_price: values.wholesale_price ?? 0,
      tax_percent: values.tax_percent ?? 0,
      discount: values.discount ?? 0,
      min_stock_level: values.min_stock_level ?? 0,
      opening_stock: values.opening_stock ?? 0,
      current_stock: values.current_stock ?? 0,
      status: values.status || "active",
      variants,
    };

    if (isEdit) updateMut.mutate(body);
    else createMut.mutate(body);
  };

  const pending = createMut.isPending || updateMut.isPending;

  return (
    <PageShell
      title={isEdit ? "Edit product" : "Add product"}
      description="Master data, GST, pricing, and variants (size / color / weight / volume)."
      breadcrumb={[
        { title: "Home", path: "/" },
        { title: "Products", path: "/products" },
        { title: isEdit ? "Edit" : "Add" },
      ]}
    >
      <Card bordered={false} className="ims-card" loading={isEdit && loadingProduct}>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{
            unit_type: "pcs",
            status: "active",
            tax_percent: 0,
            discount: 0,
            purchase_price: 0,
            selling_price: 0,
            wholesale_price: 0,
            min_stock_level: 0,
            opening_stock: 0,
            current_stock: 0,
            variants: [newVariantRow()],
          }}
        >
          <Typography.Title level={5}>Product information</Typography.Title>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="name" label="Product name" rules={[{ required: true, whitespace: true }]}>
                <Input placeholder="e.g. Cotton shirt" />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="sku" label="SKU" rules={[{ required: true, whitespace: true }]}>
                <Input placeholder="Master SKU" />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="barcode" label="Barcode">
                <Input placeholder="Optional" allowClear />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="category_cascade"
                label="Category / sub-category"
                rules={[{ required: true, message: "Pick a category" }]}
              >
                <Cascader
                  options={cascaderOpts}
                  changeOnSelect
                  placeholder="e.g. Apparel › Shirts"
                  showSearch={{
                    filter: (inputVal, path) =>
                      path.some((p) => String(p.label || "").toLowerCase().includes(inputVal.toLowerCase())),
                  }}
                  style={{ width: "100%" }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item
                name="brand"
                label="Brand"
                extra={
                  brands.length === 0 ? (
                    <Typography.Text type="secondary">
                      No brands yet. Open{" "}
                      <Link to="/brands">Catalog → Brands</Link> to create them, then return here.
                    </Typography.Text>
                  ) : null
                }
              >
                <Select
                  allowClear
                  placeholder="Optional"
                  options={brands.map((b) => ({ value: b.id, label: b.name }))}
                  showSearch
                  optionFilterProp="label"
                  notFoundContent={
                    <Typography.Text type="secondary">
                      No matches. <Link to="/brands">Add a brand</Link>
                    </Typography.Text>
                  }
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="unit_type" label="Unit">
                <Input placeholder="pcs, kg, L …" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Short description" />
          </Form.Item>

          <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
            <strong>Pricing tips:</strong> Use digits only for amounts (no letters). Selling price should be{" "}
            <strong>the same or higher than</strong> cost price. GST and discount are <strong>percentages</strong>{" "}
            from <strong>0</strong> to <strong>100</strong> — for example enter <strong>18</strong> for eighteen percent
            tax, not “18%” text.
          </Typography.Paragraph>

          <Row gutter={16}>
            <Col xs={24} sm={12} md={6}>
              <Form.Item
                name="purchase_price"
                label="Cost price"
                extra="What you pay the supplier (numbers only)."
                rules={[
                  { required: true, message: "Enter cost price." },
                  {
                    type: "number",
                    min: 0,
                    message: "Cost cannot be negative.",
                  },
                ]}
              >
                <InputNumber min={0} step={0.01} precision={2} style={{ width: "100%" }} controls />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item
                name="selling_price"
                label="Selling price"
                dependencies={["purchase_price"]}
                extra="Normal shop price to customers."
                rules={[
                  { required: true, message: "Enter selling price." },
                  { type: "number", min: 0, message: "Selling price cannot be negative." },
                  ({ getFieldValue }) => ({
                    validator(_, selling) {
                      const cost = Number(getFieldValue("purchase_price"));
                      const s = Number(selling);
                      if (Number.isFinite(cost) && Number.isFinite(s) && s < cost) {
                        return Promise.reject(
                          new Error("Selling price is usually not lower than cost price — check the amounts."),
                        );
                      }
                      return Promise.resolve();
                    },
                  }),
                ]}
              >
                <InputNumber min={0} step={0.01} precision={2} style={{ width: "100%" }} controls />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item
                name="wholesale_price"
                label="Wholesale price"
                dependencies={["selling_price"]}
                extra="Bulk price — normally same or lower than selling."
                rules={[
                  { type: "number", min: 0, message: "Cannot be negative." },
                  ({ getFieldValue }) => ({
                    validator(_, wholesale) {
                      if (wholesale === undefined || wholesale === null || wholesale === "") {
                        return Promise.resolve();
                      }
                      const sell = Number(getFieldValue("selling_price"));
                      const w = Number(wholesale);
                      if (!Number.isFinite(sell) || !Number.isFinite(w)) {
                        return Promise.resolve();
                      }
                      if (w > sell) {
                        return Promise.reject(
                          new Error("Wholesale is usually not higher than selling price — fix or leave blank."),
                        );
                      }
                      return Promise.resolve();
                    },
                  }),
                ]}
              >
                <InputNumber min={0} step={0.01} precision={2} style={{ width: "100%" }} controls />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item
                name="tax_percent"
                label="GST / tax %"
                extra="Numbers from 0–100 only (tax rate, not rupees)."
                rules={[
                  { required: true, message: "Enter GST/tax percent (use 0 if none)." },
                  {
                    type: "number",
                    min: 0,
                    max: 100,
                    message: "Must be between 0 and 100.",
                  },
                ]}
              >
                <InputNumber
                  min={0}
                  max={100}
                  step={0.01}
                  precision={2}
                  addonAfter="%"
                  style={{ width: "100%" }}
                  controls
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={8} md={6}>
              <Form.Item
                name="discount"
                label="Discount %"
                extra="Max discount on this item (0–100). Letters not allowed."
                rules={[
                  {
                    type: "number",
                    min: 0,
                    max: 100,
                    message: "Discount must be between 0 and 100.",
                  },
                ]}
              >
                <InputNumber
                  min={0}
                  max={100}
                  step={0.01}
                  precision={2}
                  addonAfter="%"
                  style={{ width: "100%" }}
                  controls
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8} md={6}>
              <Form.Item
                name="min_stock_level"
                label="Min stock alert"
                extra="Whole number — warn when stock falls below this."
                rules={[{ type: "number", min: 0, message: "Use zero or a positive whole number." }]}
              >
                <InputNumber min={0} precision={0} style={{ width: "100%" }} controls />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8} md={6}>
              <Form.Item
                name="opening_stock"
                label="Opening stock"
                rules={[{ type: "number", min: 0, message: "Use zero or more." }]}
              >
                <InputNumber min={0} precision={0} style={{ width: "100%" }} controls />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8} md={6}>
              <Form.Item
                name="current_stock"
                label="Current stock"
                rules={[{ type: "number", min: 0, message: "Use zero or more." }]}
              >
                <InputNumber min={0} precision={0} style={{ width: "100%" }} controls />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8} md={6}>
              <Form.Item name="status" label="Status" rules={[{ required: true }]}>
                <Select options={STATUS_OPTIONS} />
              </Form.Item>
            </Col>
          </Row>

          <Divider />
          <Typography.Title level={5}>Product variants</Typography.Title>
          <Typography.Paragraph type="secondary">
            One row per variant (e.g. Small / Medium / Large). Each row needs a unique variant SKU; price ± adds to
            the selling price for POS for that variant.
          </Typography.Paragraph>

          <Form.List name="variants">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field) => (
                  <Card key={field.key} size="small" style={{ marginBottom: 12 }} type="inner">
                    <Row gutter={[12, 8]} align="middle">
                      <Col xs={24} sm={6} md={4}>
                        <Form.Item {...field} name={[field.name, "size"]} label="Size">
                          <Input placeholder="S, M, L" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={6} md={4}>
                        <Form.Item {...field} name={[field.name, "color"]} label="Color">
                          <Input placeholder="Navy" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={6} md={4}>
                        <Form.Item {...field} name={[field.name, "weight"]} label="Weight">
                          <InputNumber min={0} step={0.001} style={{ width: "100%" }} placeholder="kg" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={6} md={4}>
                        <Form.Item {...field} name={[field.name, "volume"]} label="Volume">
                          <InputNumber min={0} step={0.001} style={{ width: "100%" }} placeholder="L" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={8} md={5}>
                        <Form.Item {...field} name={[field.name, "sku"]} label="Variant SKU">
                          <Input placeholder="Required if row is kept" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={8} md={4}>
                        <Form.Item
                          {...field}
                          name={[field.name, "price_modifier"]}
                          label="Price ±"
                          rules={[
                            {
                              validator(_, v) {
                                if (v === undefined || v === null || v === "") return Promise.resolve();
                                if (typeof v === "number" && Number.isFinite(v)) return Promise.resolve();
                                return Promise.reject(new Error("Enter a number only."));
                              },
                            },
                          ]}
                        >
                          <InputNumber step={0.01} precision={2} style={{ width: "100%" }} controls />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={6} md={3}>
                        <Form.Item
                          {...field}
                          name={[field.name, "stock"]}
                          label="Stock"
                          rules={[{ type: "number", min: 0, message: "Stock cannot be negative." }]}
                        >
                          <InputNumber min={0} precision={0} style={{ width: "100%" }} controls />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={2} md={1} style={{ textAlign: "right" }}>
                        <Form.Item label=" ">
                          <Button
                            type="text"
                            danger
                            icon={<MinusCircleOutlined />}
                            onClick={() => remove(field.name)}
                            disabled={fields.length <= 1}
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item name={[field.name, "id"]} hidden>
                      <Input />
                    </Form.Item>
                    <Form.Item name={[field.name, "key"]} hidden>
                      <Input />
                    </Form.Item>
                  </Card>
                ))}
                <Button type="dashed" onClick={() => add(newVariantRow())} block icon={<PlusOutlined />}>
                  Add variant
                </Button>
              </>
            )}
          </Form.List>

          <Space style={{ marginTop: 24 }}>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={pending}>
              {isEdit ? "Save changes" : "Create product"}
            </Button>
            <Link to={isEdit ? `/products/${id}` : "/products"}>
              <Button disabled={pending}>Cancel</Button>
            </Link>
          </Space>
        </Form>
      </Card>
    </PageShell>
  );
}
