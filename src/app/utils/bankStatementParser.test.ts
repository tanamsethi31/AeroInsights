import { describe, it, expect } from "vitest";
import { detectColumns, applyMappings, parseFile } from "./bankStatementParser";
import type { ColumnMapping } from "./bankStatementParser";

// ── Test 1: column detection ──────────────────────────────────────────────────

describe("detectColumns", () => {
  it("detects correct roles for common bank statement headers", () => {
    const mappings = detectColumns(["Value Date", "Narrative", "DR", "CR", "Balance"]);
    expect(mappings[0].role).toBe("date");
    expect(mappings[1].role).toBe("description");
    expect(mappings[2].role).toBe("debit");
    expect(mappings[3].role).toBe("credit");
    expect(mappings[4].role).toBe("balance");
  });

  it("suppresses Amount when both Debit and Credit columns exist", () => {
    const mappings = detectColumns(["Date", "Description", "Debit", "Credit", "Amount"]);
    const amountCol = mappings.find(m => m.header === "Amount");
    expect(amountCol?.role).toBe("ignore");
  });
});

// ── Test 2: CSV debit/credit format ──────────────────────────────────────────

describe("applyMappings — debit/credit columns", () => {
  it("correctly signs amounts: credit positive, debit negative", () => {
    const rows = [
      ["2026-01-01", "Deposit",    "0.00",   "1000.00"],
      ["2026-01-02", "Withdrawal", "200.00", "0.00"  ],
      ["2026-01-03", "Fee",        "50.00",  "0.00"  ],
    ];
    const mappings: ColumnMapping[] = [
      { index: 0, header: "Date",        role: "date"        },
      { index: 1, header: "Description", role: "description" },
      { index: 2, header: "Debit",       role: "debit"       },
      { index: 3, header: "Credit",      role: "credit"      },
    ];
    const { transactions, errors } = applyMappings(rows, mappings);
    expect(errors).toHaveLength(0);
    expect(transactions).toHaveLength(3);
    expect(transactions[0].amount).toBe(1000);
    expect(transactions[1].amount).toBe(-200);
    expect(transactions[2].amount).toBe(-50);
  });
});

// ── Test 3: single-amount column ─────────────────────────────────────────────

describe("applyMappings — single amount column", () => {
  it("treats positive as credit and negative as debit", () => {
    const rows = [
      ["2026-02-01", "Salary",  "5000" ],
      ["2026-02-02", "Rent",    "-1200"],
    ];
    const mappings: ColumnMapping[] = [
      { index: 0, header: "Date",   role: "date"        },
      { index: 1, header: "Memo",   role: "description" },
      { index: 2, header: "Amount", role: "amount"      },
    ];
    const { transactions, errors } = applyMappings(rows, mappings);
    expect(errors).toHaveLength(0);
    expect(transactions[0].amount).toBe(5000);
    expect(transactions[1].amount).toBe(-1200);
  });
});

// ── Test 4: date format tolerance ────────────────────────────────────────────

describe("applyMappings — date format tolerance", () => {
  it("parses DD/MM/YYYY and ISO dates to ISO strings", () => {
    const rows = [
      ["15/03/2026", "Transfer A", "100"],
      ["2026-04-20", "Transfer B", "200"],
    ];
    const mappings: ColumnMapping[] = [
      { index: 0, header: "Date",   role: "date"        },
      { index: 1, header: "Desc",   role: "description" },
      { index: 2, header: "Amount", role: "amount"      },
    ];
    const { transactions, errors } = applyMappings(rows, mappings);
    expect(errors).toHaveLength(0);
    expect(transactions[0].valueDate).toBe("2026-03-15");
    expect(transactions[1].valueDate).toBe("2026-04-20");
  });
});

// ── Test 5: skip invalid rows ─────────────────────────────────────────────────

describe("applyMappings — skip invalid rows", () => {
  it("skips rows with unparseable dates and adds to errors; valid rows still import", () => {
    const rows = [
      ["not-a-date", "Transfer A", "100"],
      ["2026-01-10", "Transfer B", "200"],
    ];
    const mappings: ColumnMapping[] = [
      { index: 0, header: "Date",   role: "date"        },
      { index: 1, header: "Desc",   role: "description" },
      { index: 2, header: "Amount", role: "amount"      },
    ];
    const { transactions, errors } = applyMappings(rows, mappings);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("not-a-date");
    expect(transactions).toHaveLength(1);
    expect(transactions[0].valueDate).toBe("2026-01-10");
  });
});

// ── Test 6: parseFile — xlsx ──────────────────────────────────────────────────

describe("parseFile — xlsx", () => {
  async function makeMockXlsx(rows: string[][]): Promise<File> {
    const wb = new (await import("exceljs")).default.Workbook();
    const ws = wb.addWorksheet("Sheet1");
    rows.forEach((r) => ws.addRow(r));
    const buf = await wb.xlsx.writeBuffer();
    return new File([buf as ArrayBuffer], "stmt.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  }

  it("parses headers and rows from an xlsx bank statement", async () => {
    const file = await makeMockXlsx([
      ["Value Date", "Narrative", "DR", "CR"],
      ["2026-01-01", "Opening balance", "0", "5000"],
      ["2026-01-02", "Withdrawal", "200", "0"],
    ]);
    const result = await parseFile(file);
    expect(result.errors).toHaveLength(0);
    expect(result.headers).toEqual(["Value Date", "Narrative", "DR", "CR"]);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].amount).toBe(5000);
    expect(result.transactions[1].amount).toBe(-200);
  });
});

// ── Test 7: parseFile — CSV ───────────────────────────────────────────────────

describe("parseFile — CSV", () => {
  it("parses headers and rows from a CSV bank statement", async () => {
    const csv = "Date,Description,Amount\n2026-02-01,Salary,5000\n2026-02-02,Rent,-1200";
    const file = new File([csv], "stmt.csv", { type: "text/csv" });
    const result = await parseFile(file);
    expect(result.errors).toHaveLength(0);
    expect(result.headers).toEqual(["Date", "Description", "Amount"]);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].amount).toBe(5000);
    expect(result.transactions[1].amount).toBe(-1200);
  });
});
