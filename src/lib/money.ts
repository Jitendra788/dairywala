export function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export function formatQty(value: number) {
  return `${(value || 0).toFixed(1)} L`;
}
