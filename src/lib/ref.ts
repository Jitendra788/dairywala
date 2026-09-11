export function shortRef(prefix: string, id: string) {
  const tail = (id.includes("-") ? id.split("-").pop() : id) || id;
  return `${prefix}-${tail.slice(0, 8).toUpperCase()}`;
}

export function slipRef(id: string) {
  return shortRef("SL", id);
}

export function billRef(id: string) {
  return shortRef("BL", id);
}

export function advanceRef(id: string) {
  return shortRef("AD", id);
}

export function saleRef(id: string) {
  return shortRef("WI", id);
}

export function paymentRef(id: string, date: string) {
  return `PAY-${date.replace(/-/g, "")}-${(id.split("-").pop() || id).slice(0, 8).toUpperCase()}`;
}

export function deliveryRef(id: string) {
  return shortRef("DL", id);
}

export function ledgerRef(id: string) {
  return shortRef("LD", id);
}

export function customerBillRef(id: string, year: number, month: number) {
  const mm = String(month).padStart(2, "0");
  const tail = (id.includes("-") ? id.split("-").pop() : id) || id;
  return `MB-${year}${mm}-${tail.slice(0, 8).toUpperCase()}`;
}

export function expenseRef(id: string) {
  return shortRef("EX", id);
}
