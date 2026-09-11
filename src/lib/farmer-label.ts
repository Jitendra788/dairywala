export function isInternalId(value?: string | null) {
  const v = (value || "").trim();
  return /^[a-z]{1,4}-[a-f0-9]{6,}$/i.test(v);
}

export function farmerName(farmer?: { name?: string; code?: string } | null) {
  const name = farmer?.name?.trim() || "";
  if (name && !isInternalId(name)) return name;
  const code = farmer?.code?.trim() || "";
  if (code && !isInternalId(code)) return code;
  return "Farmer";
}

export function farmerCode(farmer?: { code?: string } | null) {
  const code = farmer?.code?.trim() || "";
  return code && !isInternalId(code) ? code : "";
}

export function farmerLabel(farmer?: { name?: string; code?: string } | null) {
  const name = farmerName(farmer);
  const code = farmerCode(farmer);
  return code && code !== name ? `${code} · ${name}` : name;
}
