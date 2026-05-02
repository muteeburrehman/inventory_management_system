const symbol = import.meta.env.VITE_CURRENCY_SYMBOL || "Rs.";
const locale = import.meta.env.VITE_LOCALE || "en-PK";

export function formatCurrency(amount) {
  const n = Number(amount);
  if (Number.isNaN(n)) return `${symbol} 0.00`;
  return `${symbol} ${n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
