export const demoFarmers = [
  { id: "f-101", code: "101", name: "Ramesh Yadav" },
  { id: "f-102", code: "102", name: "Sita Devi" },
  { id: "f-103", code: "103", name: "Harish Patel" },
  { id: "f-104", code: "104", name: "Kamla Bai" },
  { id: "f-105", code: "105", name: "Jitendra Singh" },
];

export type DemoEntry = {
  id: string;
  farmerId: string;
  farmerName: string;
  qty: number;
  fat: number;
  snf: number;
  clr: number;
  rate: number;
  amount: number;
};
