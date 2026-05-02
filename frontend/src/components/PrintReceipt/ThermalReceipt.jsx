import { forwardRef } from "react";
import { formatCurrency } from "../../utils/currency.js";

export const ThermalReceipt = forwardRef(function ThermalReceipt({ sale }, ref) {
  if (!sale) return <div ref={ref} />;
  return (
    <div ref={ref} style={{ width: "80mm", fontFamily: "monospace", fontSize: 12, padding: 8 }}>
      <div style={{ textAlign: "center", fontWeight: 700 }}>{import.meta.env.VITE_APP_NAME || "IMS"}</div>
      <div style={{ textAlign: "center" }}>{sale.invoice_number}</div>
      <hr />
      <div>Total: {formatCurrency(sale.total_amount)}</div>
      <div>Paid: {formatCurrency(sale.paid_amount)}</div>
      <div>Due: {formatCurrency(sale.due_amount)}</div>
    </div>
  );
});
