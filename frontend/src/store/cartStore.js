import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      customerId: null,
      couponCode: null,
      addItem: (line) =>
        set((s) => {
          const key = `${line.productId}-${line.variantId ?? "x"}`;
          const idx = s.items.findIndex(
            (i) => `${i.productId}-${i.variantId ?? "x"}` === key
          );
          const next = [...s.items];
          if (idx >= 0) {
            next[idx] = { ...next[idx], quantity: next[idx].quantity + line.quantity };
          } else {
            next.push({ ...line, key });
          }
          return { items: next };
        }),
      updateQty: (key, quantity) =>
        set((s) => ({
          items: s.items.map((i) => (i.key === key ? { ...i, quantity } : i)),
        })),
      removeItem: (key) => set((s) => ({ items: s.items.filter((i) => i.key !== key) })),
      setCustomer: (customerId) => set({ customerId }),
      setCoupon: (couponCode) => set({ couponCode }),
      couponDiscount: 0,
      setCouponDiscount: (couponDiscount) => set({ couponDiscount }),
      loadFromSale: (sale) =>
        set({
          customerId: sale.customer ?? null,
          couponCode: null,
          couponDiscount: 0,
          items: (sale.items || []).map((line, i) => ({
            key: `${line.product}-${line.variant ?? "x"}-${i}`,
            productId: line.product,
            variantId: line.variant,
            name: line.product_name || `Product #${line.product}`,
            sku: line.sku || "",
            quantity: line.quantity,
            unitPrice: Number(line.unit_price),
            discount: Number(line.discount || 0),
            tax: Number(line.tax || 0),
          })),
        }),
      reset: () => set({ items: [], customerId: null, couponCode: null, couponDiscount: 0 }),
    }),
    { name: "ims-pos-cart" }
  )
);
