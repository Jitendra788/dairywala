export const CUSTOMER_STATUSES = ["active", "paused", "stopped"] as const;
export const MILK_TYPES = ["cow", "buffalo", "mixed"] as const;
export const PAYMENT_CYCLES = ["daily", "weekly", "10-day", "monthly"] as const;
export const DELIVERY_STATUSES = [
  "pending",
  "delivered",
  "skipped",
  "partial",
  "extra",
  "not_delivered",
] as const;
export const PAYMENT_MODES = ["cash", "upi", "bank", "card"] as const;

export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];
export type CustomerMilkType = (typeof MILK_TYPES)[number];
export type PaymentCycle = (typeof PAYMENT_CYCLES)[number];
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export type Customer = {
  id: string;
  dairyId: string;
  customerCode: string;
  name: string;
  mobile: string;
  address: string;
  milkType: CustomerMilkType;
  status: CustomerStatus;
  createdAt: string;
  updatedAt: string;
};

export type CustomerSubscription = {
  id: string;
  dairyId: string;
  customerId: string;
  dailyQty: number;
  rate: number;
  startDate: string;
  deliveryTime: string;
  paymentCycle: PaymentCycle;
  pauseFrom: string | null;
  resumeDate: string | null;
  status: CustomerStatus;
  createdAt: string;
  updatedAt: string;
};

export type DailyMilkDelivery = {
  id: string;
  dairyId: string;
  customerId: string;
  date: string;
  regularQty: number;
  extraQty: number;
  deliveredQty: number;
  rate: number;
  amount: number;
  status: DeliveryStatus;
  skipReason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MilkLedger = {
  id: string;
  dairyId: string;
  customerId: string;
  date: string;
  regularQty: number;
  extraQty: number;
  deliveredQty: number;
  rate: number;
  amount: number;
  status: DeliveryStatus;
  deliveryId: string;
  createdAt: string;
};

export type CustomerPayment = {
  id: string;
  dairyId: string;
  customerId: string;
  date: string;
  amount: number;
  mode: PaymentMode;
  reference: string;
  remainingBalance: number;
  createdAt: string;
};

export type MonthlyBill = {
  id: string;
  dairyId: string;
  customerId: string;
  year: number;
  month: number;
  totalDelivered: number;
  totalAmount: number;
  skippedDays: number;
  extraMilk: number;
  paidAmount: number;
  outstanding: number;
  updatedAt: string;
};

export type CreateCustomerInput = {
  name: string;
  mobile: string;
  address: string;
  milkType: CustomerMilkType;
  dailyQty: number;
  rate: number;
  startDate: string;
  deliveryTime: string;
  paymentCycle: PaymentCycle;
  status: CustomerStatus;
};

export type UpdateCustomerInput = Partial<
  Pick<CreateCustomerInput, "name" | "mobile" | "address" | "milkType" | "dailyQty" | "rate" | "deliveryTime" | "paymentCycle" | "status">
>;

export type CustomerRow = Customer & {
  subscription: CustomerSubscription | null;
  todayDelivery: DailyMilkDelivery | null;
  outstanding: number;
};

export type DeliveryRow = DailyMilkDelivery & {
  customer: Customer;
  subscription: CustomerSubscription | null;
};

export type LedgerRow = MilkLedger & {
  customer: Customer;
};

export type BillRow = MonthlyBill & {
  customer: Customer;
};

export type PaymentRow = CustomerPayment & {
  customer: Customer;
};
