export type ModuleStatus = "ready" | "building" | "planned";

export type ModuleScreen = {
  name: string;
  path: string;
  purpose: string;
};

export type ModuleTable = {
  name: string;
  fields: string[];
};

export type DairyModule = {
  slug: string;
  name: string;
  nameHi: string;
  group: "operations" | "procurement" | "plant" | "farm" | "business";
  phase: 1 | 2 | 3 | 4;
  status: ModuleStatus;
  summary: string;
  hamariRef: string;
  screens: ModuleScreen[];
  tables: ModuleTable[];
  workflow: string[];
  roles: string[];
};

export const phases = [
  {
    id: 1,
    title: "Small dairy & collection",
    subtitle: "Milk, quality, rate chart, farmer payment",
  },
  {
    id: 2,
    title: "Procurement network",
    subtitle: "BMC, chilling, tanker trips, plant intake",
  },
  {
    id: 3,
    title: "Plant & group ERP",
    subtitle: "Tanks, production, stock, sales, finance",
  },
  {
    id: 4,
    title: "Livestock OS",
    subtitle: "Herd, health, breeding, yield, farm P&L",
  },
] as const;

export const modules: DairyModule[] = [
  {
    slug: "collection",
    name: "Milk Collection",
    nameHi: "दूध संग्रह",
    group: "operations",
    phase: 1,
    status: "building",
    summary:
      "Shift-wise milk entry with quantity, FAT, SNF and CLR. Analyzer and scale values post into one farmer receipt.",
    hamariRef: "Collection app + milk collection system",
    screens: [
      { name: "Shift desk", path: "/collection", purpose: "Morning/evening collection list and live totals" },
      { name: "New receipt", path: "/collection/new", purpose: "Farmer, weight, analyzer values, rate, slip" },
      { name: "Receipt detail", path: "/collection/[id]", purpose: "Edit, reprint slip, void with reason" },
      { name: "Shift close", path: "/collection/close", purpose: "Reconcile cans, print shift report" },
    ],
    tables: [
      { name: "collection_shifts", fields: ["id", "dairy_id", "shift", "date", "center_id", "status", "closed_at"] },
      { name: "collection_entries", fields: ["id", "shift_id", "farmer_id", "qty_ltr", "fat", "snf", "clr", "rate", "amount", "source"] },
      { name: "analyzer_readings", fields: ["id", "entry_id", "device_id", "raw_payload", "fat", "snf", "clr", "added_water"] },
    ],
    workflow: [
      "Open morning or evening shift at the centre",
      "Identify farmer, capture scale weight",
      "Read FAT / SNF / CLR from analyzer",
      "Apply rate chart and print slip",
      "Farmer sees receipt and running balance",
      "Close shift and lock totals for payment",
    ],
    roles: ["Operator", "Centre manager", "Farmer (view slip)"],
  },
  {
    slug: "farmers",
    name: "Farmers & Parties",
    nameHi: "किसान व पार्टी",
    group: "operations",
    phase: 1,
    status: "planned",
    summary:
      "Master records for farmers, suppliers, BMCs and buyers — codes, bank details, language and centre mapping.",
    hamariRef: "Supplier / farmer masters",
    screens: [
      { name: "Farmer directory", path: "/farmers", purpose: "Search, filter by centre/route, KYC status" },
      { name: "Farmer profile", path: "/farmers/[id]", purpose: "Ledger, collection history, advances, cattle" },
      { name: "Onboard farmer", path: "/farmers/new", purpose: "Code, name, phone, bank, language, centre" },
    ],
    tables: [
      { name: "parties", fields: ["id", "type", "code", "name", "phone", "language", "center_id", "status"] },
      { name: "party_banks", fields: ["id", "party_id", "account_name", "account_no", "ifsc", "upi"] },
      { name: "party_kyc", fields: ["id", "party_id", "aadhaar_ref", "docs", "verified_at"] },
    ],
    workflow: [
      "Create farmer or supplier with unique dairy code",
      "Attach centre, route and language",
      "Save bank / UPI for payouts",
      "Collection and payments post to the same party ledger",
    ],
    roles: ["Admin", "Centre manager"],
  },
  {
    slug: "rate-charts",
    name: "Rate Charts",
    nameHi: "रेट चार्ट",
    group: "operations",
    phase: 1,
    status: "planned",
    summary:
      "Quality-linked pricing: FAT-only, FAT+SNF, two-axis and slab charts, plus incentives and deductions.",
    hamariRef: "Quality-based rate charts & policies",
    screens: [
      { name: "Chart list", path: "/rate-charts", purpose: "Active charts by centre, milk type, date range" },
      { name: "Chart builder", path: "/rate-charts/[id]", purpose: "Upload or grid-edit FAT/SNF cells" },
      { name: "Policy rules", path: "/rate-charts/policies", purpose: "Bonus, cattle-feed recovery, incentives" },
    ],
    tables: [
      { name: "rate_charts", fields: ["id", "name", "type", "milk_type", "valid_from", "valid_to", "center_id"] },
      { name: "rate_cells", fields: ["id", "chart_id", "fat", "snf", "rate"] },
      { name: "rate_policies", fields: ["id", "chart_id", "rule_type", "formula", "priority"] },
    ],
    workflow: [
      "Choose chart type (FAT, FAT+SNF, slab, two-axis)",
      "Upload Excel or edit the grid",
      "Assign to centre / milk type / date range",
      "Collection entry looks up rate at save time",
    ],
    roles: ["Admin", "Head office"],
  },
  {
    slug: "payments",
    name: "Billing & Payments",
    nameHi: "बिल व भुगतान",
    group: "operations",
    phase: 1,
    status: "planned",
    summary:
      "Period bills, advances, deductions and bank / UPI settlement against the same collection records.",
    hamariRef: "Billing, payments, ledgers",
    screens: [
      { name: "Payment cycles", path: "/payments", purpose: "10-day / weekly / custom billing periods" },
      { name: "Farmer bill", path: "/payments/bills/[id]", purpose: "Qty, avg FAT/SNF, deductions, net pay" },
      { name: "Payout batch", path: "/payments/payouts", purpose: "Bank file export or UPI push" },
      { name: "Advances", path: "/payments/advances", purpose: "Loan, feed, cash advance recovery" },
    ],
    tables: [
      { name: "billing_cycles", fields: ["id", "from_date", "to_date", "status", "center_id"] },
      { name: "farmer_bills", fields: ["id", "cycle_id", "farmer_id", "qty", "avg_fat", "avg_snf", "gross", "net"] },
      { name: "advances", fields: ["id", "farmer_id", "type", "amount", "recovered", "status"] },
      { name: "payouts", fields: ["id", "bill_id", "method", "ref_no", "status", "paid_at"] },
    ],
    workflow: [
      "Close all shifts in the billing period",
      "Generate bills from locked collection entries",
      "Apply advances, feed and other deductions",
      "Export bank file or send UPI payout",
      "Post to party ledger and mark paid",
    ],
    roles: ["Accountant", "Centre manager", "Admin"],
  },
  {
    slug: "network",
    name: "BMC & Network",
    nameHi: "बीएमसी नेटवर्क",
    group: "procurement",
    phase: 2,
    status: "planned",
    summary:
      "Own and agent BMCs, village societies and chilling centres on one supplier network with agreements.",
    hamariRef: "Milk procurement platform",
    screens: [
      { name: "Network map", path: "/network", purpose: "Centres, BMCs, plants and ownership model" },
      { name: "BMC desk", path: "/network/bmc/[id]", purpose: "Intake, tank temp, dispatch to plant" },
      { name: "Agreements", path: "/network/agreements", purpose: "Commission, common charges, documents" },
    ],
    tables: [
      { name: "locations", fields: ["id", "type", "name", "parent_id", "lat", "lng", "model"] },
      { name: "agreements", fields: ["id", "party_id", "location_id", "commission", "valid_from", "valid_to"] },
      { name: "chilling_logs", fields: ["id", "location_id", "tank_id", "temp", "recorded_at"] },
    ],
    workflow: [
      "Register society, own BMC or agent BMC",
      "Attach farmers and rate policy",
      "Record chilling temperature and tank stock",
      "Dispatch tanker with source allocations",
    ],
    roles: ["Procurement", "BMC operator", "Head office"],
  },
  {
    slug: "logistics",
    name: "Routes & Logistics",
    nameHi: "रूट व लॉजिस्टिक्स",
    group: "procurement",
    phase: 2,
    status: "planned",
    summary:
      "Routes, vehicles, drivers, GPS trips and truck sheets from village pickup to plant gate.",
    hamariRef: "Pickup & driver app",
    screens: [
      { name: "Trip board", path: "/logistics", purpose: "Today's routes, vehicles and trip status" },
      { name: "Truck sheet", path: "/logistics/trips/[id]", purpose: "Stops, cans, samples, GPS trail" },
      { name: "Fleet", path: "/logistics/fleet", purpose: "Vehicles, drivers, freight and fuel" },
    ],
    tables: [
      { name: "routes", fields: ["id", "name", "plant_id", "stops_json"] },
      { name: "vehicles", fields: ["id", "reg_no", "type", "capacity_ltr", "gps_device"] },
      { name: "trips", fields: ["id", "route_id", "vehicle_id", "driver_id", "status", "started_at"] },
      { name: "truck_sheet_lines", fields: ["id", "trip_id", "stop_id", "qty", "fat", "snf", "seal_no"] },
    ],
    workflow: [
      "Plan route and assign vehicle / driver",
      "Pickup app records each stop on the same collection record",
      "Seal samples and close truck sheet",
      "GPS trail and freight cost allocate per litre",
    ],
    roles: ["Driver", "Route supervisor", "Procurement"],
  },
  {
    slug: "intake",
    name: "Plant Intake",
    nameHi: "प्लांट इनटेक",
    group: "procurement",
    phase: 2,
    status: "planned",
    summary:
      "Weighbridge and lab re-test at the gate. Source vs intake solids variance is flagged per trip.",
    hamariRef: "Plant intake + quality variance",
    screens: [
      { name: "Gate queue", path: "/intake", purpose: "Incoming tankers and cans by shift" },
      { name: "Intake ticket", path: "/intake/[id]", purpose: "Weighment, lab, variance, accept/reject" },
      { name: "Variance desk", path: "/intake/variance", purpose: "Per route / trip solids loss" },
    ],
    tables: [
      { name: "intake_tickets", fields: ["id", "trip_id", "gross_wt", "tare_wt", "lab_fat", "lab_snf", "status"] },
      { name: "intake_variances", fields: ["id", "ticket_id", "qty_var", "fat_var", "snf_var", "solids_var"] },
      { name: "rejection_codes", fields: ["id", "code", "reason"] },
    ],
    workflow: [
      "Tanker arrives; weighbridge captures weight",
      "Lab re-tests FAT / SNF / CLR",
      "Match against BMC dispatch truck sheet",
      "Accept, hold or reject with code",
      "Accepted milk posts to tank / silo stock",
    ],
    roles: ["Gate", "Lab", "Plant manager"],
  },
  {
    slug: "tanks",
    name: "Tanks & CIP",
    nameHi: "टैंक व सीआईपी",
    group: "plant",
    phase: 3,
    status: "planned",
    summary:
      "Silo and tank balances, transfers, temperature logs and CIP cycle records on the plant floor.",
    hamariRef: "Plant floor, tanks & CIP",
    screens: [
      { name: "Tank board", path: "/tanks", purpose: "Live litres, temp and product in each silo" },
      { name: "Transfer", path: "/tanks/transfer", purpose: "Move milk between tanks with quality" },
      { name: "CIP log", path: "/tanks/cip", purpose: "Program, chemicals, checklist, verification" },
    ],
    tables: [
      { name: "tanks", fields: ["id", "code", "capacity", "product", "qty", "temp", "plant_id"] },
      { name: "tank_movements", fields: ["id", "from_tank", "to_tank", "qty", "reason", "user_id"] },
      { name: "cip_cycles", fields: ["id", "tank_id", "program", "started_at", "verified_at", "status"] },
    ],
    workflow: [
      "Intake milk lands in a receiving tank",
      "Record temperature and transfers",
      "Allocate milk to production or bulk sale",
      "Run and verify CIP before next fill",
    ],
    roles: ["Plant operator", "QA"],
  },
  {
    slug: "production",
    name: "Production",
    nameHi: "उत्पादन",
    group: "plant",
    phase: 3,
    status: "planned",
    summary:
      "Recipes, BOMs, work orders and batches from raw milk to packed finished goods with costing.",
    hamariRef: "Dairy manufacturing ERP",
    screens: [
      { name: "Work orders", path: "/production", purpose: "Today's planned batches and work centres" },
      { name: "Batch ticket", path: "/production/batches/[id]", purpose: "Inputs, outputs, wastage, QC gate" },
      { name: "Recipes", path: "/production/recipes", purpose: "BOM for milk, materials and packing" },
    ],
    tables: [
      { name: "products", fields: ["id", "sku", "name", "type", "uom"] },
      { name: "recipes", fields: ["id", "product_id", "version", "yield_qty"] },
      { name: "recipe_lines", fields: ["id", "recipe_id", "item_id", "qty", "uom"] },
      { name: "work_orders", fields: ["id", "recipe_id", "qty", "status", "scheduled_at"] },
      { name: "batches", fields: ["id", "work_order_id", "lot_no", "input_qty", "output_qty", "cost"] },
    ],
    workflow: [
      "Schedule work order from recipe",
      "Issue milk and packing from tanks / stores",
      "Record batch output, wastage and QC",
      "Release lot to finished-goods stock",
      "Post batch cost to daily P&L",
    ],
    roles: ["Production", "Stores", "QA", "Finance"],
  },
  {
    slug: "inventory",
    name: "Stores & Inventory",
    nameHi: "स्टोर व स्टॉक",
    group: "plant",
    phase: 3,
    status: "planned",
    summary:
      "Materials, packaging, chemicals and finished goods with locations, valuation and consumption.",
    hamariRef: "Purchasing, inventory & stores",
    screens: [
      { name: "Stock board", path: "/inventory", purpose: "On-hand by item and location" },
      { name: "Purchase orders", path: "/inventory/po", purpose: "PO, GRN, vendor bill" },
      { name: "Issues", path: "/inventory/issues", purpose: "Issue to production or maintenance" },
    ],
    tables: [
      { name: "items", fields: ["id", "sku", "name", "category", "uom"] },
      { name: "stock_lots", fields: ["id", "item_id", "location_id", "qty", "rate", "batch_no"] },
      { name: "stock_moves", fields: ["id", "item_id", "from_loc", "to_loc", "qty", "ref_type"] },
      { name: "purchase_orders", fields: ["id", "vendor_id", "status", "eta"] },
    ],
    workflow: [
      "Raise PO for packing, chemicals or feed",
      "Goods receipt updates on-hand stock",
      "Production issues consume lots",
      "Finished goods lots wait for sales dispatch",
    ],
    roles: ["Stores", "Purchase", "Production"],
  },
  {
    slug: "quality",
    name: "Quality & Trace",
    nameHi: "क्वालिटी",
    group: "plant",
    phase: 3,
    status: "planned",
    summary:
      "Lab samples, hold/release, lot genealogy and recall from pack back to farmer route.",
    hamariRef: "Quality, traceability & recall",
    screens: [
      { name: "Lab queue", path: "/quality", purpose: "Pending samples from collection, intake, batch" },
      { name: "Lot passport", path: "/quality/lots/[id]", purpose: "Forward / backward trace" },
      { name: "Recall case", path: "/quality/recalls", purpose: "Affected lots and CAPA" },
    ],
    tables: [
      { name: "qc_samples", fields: ["id", "source_type", "source_id", "tests_json", "decision"] },
      { name: "lots", fields: ["id", "product_id", "batch_id", "qty", "status"] },
      { name: "lot_links", fields: ["id", "parent_lot", "child_lot", "qty"] },
      { name: "recalls", fields: ["id", "lot_id", "reason", "status", "capa"] },
    ],
    workflow: [
      "Create sample at collection, intake or batch",
      "Record tests and hold / release",
      "Released lot can move to sales",
      "Complaint traces pack → batch → intake → route",
    ],
    roles: ["Lab", "QA", "Plant manager"],
  },
  {
    slug: "sales",
    name: "Sales & Dispatch",
    nameHi: "बिक्री व डिस्पैच",
    group: "plant",
    phase: 3,
    status: "planned",
    summary:
      "Bulk milk and packed-product orders, credit checks, van sales, invoices and settlement.",
    hamariRef: "Sales & distribution",
    screens: [
      { name: "Orders", path: "/sales", purpose: "Bulk and product orders with credit status" },
      { name: "Dispatch", path: "/sales/dispatch", purpose: "Load vehicles and close routes" },
      { name: "Van sale", path: "/sales/van", purpose: "Route sale, returns, cash collection" },
    ],
    tables: [
      { name: "customers", fields: ["id", "name", "credit_limit", "route_id"] },
      { name: "sales_orders", fields: ["id", "customer_id", "type", "status", "total"] },
      { name: "invoices", fields: ["id", "order_id", "gst_no", "amount", "status"] },
      { name: "van_closes", fields: ["id", "route_id", "date", "cash", "credit", "returns"] },
    ],
    workflow: [
      "Create bulk or packed order",
      "Credit check and approval",
      "Allocate stock / milk and dispatch",
      "Invoice, credit note and settlement",
      "Sales value flows to daily P&L",
    ],
    roles: ["Sales", "Dispatch", "Accounts"],
  },
  {
    slug: "finance",
    name: "Finance",
    nameHi: "हिसाब",
    group: "business",
    phase: 3,
    status: "planned",
    summary:
      "Party ledgers, cash/bank, GST and daily P&L from the same operational records — no second books.",
    hamariRef: "Finance, compliance & reporting",
    screens: [
      { name: "Daily P&L", path: "/finance", purpose: "Milk in, product out, costs, margin" },
      { name: "Ledgers", path: "/finance/ledgers", purpose: "Farmer, supplier, buyer, cash, bank" },
      { name: "Vouchers", path: "/finance/vouchers", purpose: "JV, receipt, payment, contra" },
    ],
    tables: [
      { name: "accounts", fields: ["id", "code", "name", "type", "parent_id"] },
      { name: "journal_entries", fields: ["id", "date", "narration", "ref_type", "ref_id"] },
      { name: "journal_lines", fields: ["id", "entry_id", "account_id", "debit", "credit"] },
      { name: "bank_txns", fields: ["id", "account_id", "amount", "ref", "reconciled"] },
    ],
    workflow: [
      "Collection, bills, sales and stores post journals",
      "Reconcile bank and cash",
      "File GST / TDS / e-invoice from the same docs",
      "Read daily P&L per centre or plant",
    ],
    roles: ["Accountant", "Admin", "Head office"],
  },
  {
    slug: "livestock",
    name: "Livestock OS",
    nameHi: "पशुधन",
    group: "farm",
    phase: 4,
    status: "planned",
    summary:
      "Herd registry, health, breeding, milk yield, feed and per-animal profit for farms and gaushalas.",
    hamariRef: "Livestock OS",
    screens: [
      { name: "Herd", path: "/livestock", purpose: "Cattle cards, sheds and groups" },
      { name: "Animal", path: "/livestock/[id]", purpose: "Yield, health, breeding, expenses" },
      { name: "Breeding", path: "/livestock/breeding", purpose: "Heat, AI, pregnancy, calving" },
    ],
    tables: [
      { name: "animals", fields: ["id", "tag", "name", "breed", "dob", "shed_id", "status"] },
      { name: "yield_logs", fields: ["id", "animal_id", "shift", "qty", "fat", "snf"] },
      { name: "health_events", fields: ["id", "animal_id", "type", "date", "vet", "notes"] },
      { name: "breeding_events", fields: ["id", "animal_id", "event", "date", "sire"] },
    ],
    workflow: [
      "Register animal with tag and shed",
      "Log morning/evening yield",
      "Schedule vaccination and treatment",
      "Track breeding to calving",
      "See profit per animal vs feed cost",
    ],
    roles: ["Farm owner", "Gopal", "Vet"],
  },
  {
    slug: "reports",
    name: "Reports",
    nameHi: "रिपोर्ट",
    group: "business",
    phase: 1,
    status: "planned",
    summary:
      "Shift, quality, payment, route variance and plant solids-balance reports from one record.",
    hamariRef: "Analytics & reporting",
    screens: [
      { name: "Report home", path: "/reports", purpose: "Pinned daily reports by role" },
      { name: "Solids balance", path: "/reports/solids", purpose: "In / tank / out for the plant" },
      { name: "Farmer statement", path: "/reports/farmer", purpose: "Period qty, quality, pay" },
    ],
    tables: [
      { name: "saved_reports", fields: ["id", "key", "params_json", "owner_id"] },
    ],
    workflow: [
      "Every module writes operational facts",
      "Reports only read — no second data entry",
      "Export PDF / Excel in the farmer's language",
    ],
    roles: ["All roles (scoped)"],
  },
  {
    slug: "settings",
    name: "Settings",
    nameHi: "सेटिंग",
    group: "business",
    phase: 1,
    status: "building",
    summary:
      "Dairy profile, centres, users, roles, devices, languages and offline sync — the foundation layer.",
    hamariRef: "Multi-tenant SaaS + RBAC + offline",
    screens: [
      { name: "Dairy profile", path: "/settings", purpose: "Name, GST, languages, billing plan" },
      { name: "Users & roles", path: "/settings/users", purpose: "Operator, farmer, plant, HO permissions" },
      { name: "Devices", path: "/settings/devices", purpose: "Analyzer, scale, printer mappings" },
    ],
    tables: [
      { name: "dairies", fields: ["id", "name", "plan", "languages", "gstin"] },
      { name: "users", fields: ["id", "dairy_id", "name", "phone", "role", "status"] },
      { name: "roles", fields: ["id", "key", "permissions_json"] },
      { name: "devices", fields: ["id", "center_id", "type", "model", "port"] },
      { name: "sync_queue", fields: ["id", "entity", "payload", "status", "synced_at"] },
    ],
    workflow: [
      "Create isolated dairy tenant",
      "Add centres and users with roles",
      "Map analyzer / scale / printer",
      "Desktop and mobile work offline, then sync",
    ],
    roles: ["Admin"],
  },
];

export const moduleMap = Object.fromEntries(modules.map((m) => [m.slug, m]));

export function getModule(slug: string) {
  return moduleMap[slug];
}

export const journey = [
  { step: "01", title: "Collect", detail: "Farmer, centre, pickup, BMC" },
  { step: "02", title: "Make", detail: "Intake, tanks, batches, QC" },
  { step: "03", title: "Deliver", detail: "Sales, dispatch, settlement, P&L" },
] as const;

export const navGroups = [
  {
    key: "operations",
    label: "Operations",
    items: ["collection", "farmers", "rate-charts", "payments"],
  },
  {
    key: "procurement",
    label: "Procurement",
    items: ["network", "logistics", "intake"],
  },
  {
    key: "plant",
    label: "Plant",
    items: ["tanks", "production", "inventory", "quality", "sales"],
  },
  {
    key: "farm",
    label: "Farm",
    items: ["livestock"],
  },
  {
    key: "business",
    label: "Business",
    items: ["finance", "reports", "settings"],
  },
] as const;
