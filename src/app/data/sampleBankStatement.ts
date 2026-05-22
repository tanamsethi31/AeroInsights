// src/app/data/sampleBankStatement.ts
import type { BankStatement, BankTransaction } from "../hooks/useBankStatements";

export const SAMPLE_STATEMENT: BankStatement = {
  id:          "demo-stmt-1",
  orgId:       "demo",
  filename:    "DEMO_STATEMENT_Q1_2026.csv",
  currency:    "USD",
  periodLabel: "Jan – Mar 2026",
  rowCount:    30,
  uploadedAt:  "2026-04-01T09:00:00Z",
};

export const SAMPLE_TRANSACTIONS: BankTransaction[] = [
  // January
  { id: "demo-tx-01", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-01-02", description: "WIRE CREDIT REF 8821 - RENTAL INCOME",  amount:  125000, currency: "USD", reference: "REF-882101" },
  { id: "demo-tx-02", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-01-05", description: "BANK SERVICE CHARGE JAN",               amount:    -250, currency: "USD", reference: null },
  { id: "demo-tx-03", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-01-07", description: "FEE INCOME - MANAGEMENT FEES",          amount:    8500, currency: "USD", reference: "REF-110101" },
  { id: "demo-tx-04", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-01-09", description: "OUTWARD WIRE FEE",                      amount:    -185, currency: "USD", reference: null },
  { id: "demo-tx-05", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-01-12", description: "OPERATING EXPENSE - ADMIN",             amount:   -3200, currency: "USD", reference: "REF-201001" },
  { id: "demo-tx-06", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-01-15", description: "WIRE CREDIT REF 9104 - RENTAL INCOME",  amount:  162000, currency: "USD", reference: "REF-910401" },
  { id: "demo-tx-07", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-01-18", description: "INSURANCE PREMIUM Q1",                  amount:   -1800, currency: "USD", reference: "REF-INS001" },
  { id: "demo-tx-08", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-01-22", description: "MISC CREDIT - INTEREST RECEIVED",       amount:    1250, currency: "USD", reference: null },
  { id: "demo-tx-09", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-01-28", description: "OPERATING EXPENSE - ADMIN",             amount:   -5500, currency: "USD", reference: "REF-201002" },
  { id: "demo-tx-10", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-01-30", description: "OUTWARD WIRE FEE",                      amount:    -220, currency: "USD", reference: null },
  // February
  { id: "demo-tx-11", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-02-03", description: "WIRE CREDIT REF 8822 - RENTAL INCOME",  amount:  148500, currency: "USD", reference: "REF-882201" },
  { id: "demo-tx-12", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-02-05", description: "BANK SERVICE CHARGE FEB",               amount:    -300, currency: "USD", reference: null },
  { id: "demo-tx-13", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-02-07", description: "FEE INCOME - MANAGEMENT FEES",          amount:   12000, currency: "USD", reference: "REF-110202" },
  { id: "demo-tx-14", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-02-10", description: "OUTWARD WIRE FEE",                      amount:    -195, currency: "USD", reference: null },
  { id: "demo-tx-15", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-02-12", description: "OPERATING EXPENSE - ADMIN",             amount:   -4100, currency: "USD", reference: "REF-201003" },
  { id: "demo-tx-16", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-02-18", description: "WIRE CREDIT REF 9105 - RENTAL INCOME",  amount:  175000, currency: "USD", reference: "REF-910501" },
  { id: "demo-tx-17", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-02-20", description: "MISC CREDIT - INTEREST RECEIVED",       amount:     950, currency: "USD", reference: null },
  { id: "demo-tx-18", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-02-24", description: "INSURANCE PREMIUM Q1",                  amount:   -2400, currency: "USD", reference: "REF-INS002" },
  { id: "demo-tx-19", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-02-26", description: "OPERATING EXPENSE - ADMIN",             amount:   -7200, currency: "USD", reference: "REF-201004" },
  { id: "demo-tx-20", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-02-28", description: "OUTWARD WIRE FEE",                      amount:    -310, currency: "USD", reference: null },
  // March
  { id: "demo-tx-21", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-03-02", description: "WIRE CREDIT REF 8823 - RENTAL INCOME",  amount:  132000, currency: "USD", reference: "REF-882301" },
  { id: "demo-tx-22", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-03-05", description: "BANK SERVICE CHARGE MAR",               amount:    -450, currency: "USD", reference: null },
  { id: "demo-tx-23", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-03-07", description: "FEE INCOME - MANAGEMENT FEES",          amount:    6500, currency: "USD", reference: "REF-110303" },
  { id: "demo-tx-24", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-03-10", description: "OUTWARD WIRE FEE",                      amount:    -280, currency: "USD", reference: null },
  { id: "demo-tx-25", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-03-12", description: "OPERATING EXPENSE - ADMIN",             amount:   -2800, currency: "USD", reference: "REF-201005" },
  { id: "demo-tx-26", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-03-15", description: "WIRE CREDIT REF 9106 - RENTAL INCOME",  amount:  185000, currency: "USD", reference: "REF-910601" },
  { id: "demo-tx-27", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-03-18", description: "INSURANCE PREMIUM Q1",                  amount:   -2900, currency: "USD", reference: "REF-INS003" },
  { id: "demo-tx-28", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-03-22", description: "MISC CREDIT - INTEREST RECEIVED",       amount:    1750, currency: "USD", reference: null },
  { id: "demo-tx-29", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-03-25", description: "OPERATING EXPENSE - ADMIN",             amount:   -6400, currency: "USD", reference: "REF-201006" },
  { id: "demo-tx-30", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-03-28", description: "OUTWARD WIRE FEE",                      amount:    -340, currency: "USD", reference: null },
];
