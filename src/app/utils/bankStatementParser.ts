import * as XLSX from "xlsx";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ColumnRole =
  | "date"
  | "description"
  | "debit"
  | "credit"
  | "amount"    // signed: positive = credit
  | "balance"
  | "reference"
  | "ignore";

export interface ColumnMapping {
  index:  number;
  header: string;
  role:   ColumnRole;
}

export interface ParsedTransaction {
  valueDate:   string;   // ISO date YYYY-MM-DD
  description: string;
  amount:      number;   // signed: positive = credit, negative = debit
  reference:   string;
}

export interface ParseResult {
  headers:      string[];
  rawRows:      string[][];    // first 5 data rows (for column-mapping preview table)
  allDataRows:  string[][];    // all data rows (used when re-applying mappings in modal)
  mappings:     ColumnMapping[];
  transactions: ParsedTransaction[];
  errors:       string[];
}

// ── Column detection ──────────────────────────────────────────────────────────

const ROLE_KEYWORDS: Record<Exclude<ColumnRole, "ignore">, string[]> = {
  date:        ["date", "value date", "posting date", "trans date", "txn date", "transaction date"],
  description: ["description", "narrative", "details", "particulars", "memo", "remarks"],
  debit:       ["debit", "dr", "withdrawal", "withdrawals", "out", "paid out", "charge"],
  credit:      ["credit", "cr", "deposit", "deposits", "received", "paid in"],
  amount:      ["amount", "net amount", "net", "value"],
  balance:     ["balance", "running balance", "closing balance"],
  reference:   ["reference", "ref", "cheque", "check", "voucher", "id"],
};

export function detectColumns(headers: string[]): ColumnMapping[] {
  const mappings: ColumnMapping[] = headers.map((header, index) => {
    const lower = header.toLowerCase().trim();
    for (const [role, keywords] of Object.entries(ROLE_KEYWORDS) as [Exclude<ColumnRole, "ignore">, string[]][]) {
      if (keywords.some(kw => lower.includes(kw))) {
        return { index, header, role };
      }
    }
    return { index, header, role: "ignore" as ColumnRole };
  });

  // If both debit+credit AND amount are present, prefer debit/credit — suppress amount
  const hasDebit  = mappings.some(m => m.role === "debit");
  const hasCredit = mappings.some(m => m.role === "credit");
  if (hasDebit && hasCredit) {
    for (const m of mappings) {
      if (m.role === "amount") m.role = "ignore";
    }
  }

  return mappings;
}

// ── Date parsing ──────────────────────────────────────────────────────────────

function parseDate(value: string): string | null {
  if (!value || !value.trim()) return null;

  // DD/MM/YYYY — must check before native parse to avoid MM/DD/YYYY misinterpretation
  const m1 = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) {
    const d2 = new Date(`${m1[3]}-${m1[2].padStart(2, "0")}-${m1[1].padStart(2, "0")}`);
    if (!isNaN(d2.getTime())) return d2.toISOString().slice(0, 10);
  }

  // YYYYMMDD
  const m3 = value.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m3) {
    const d4 = new Date(`${m3[1]}-${m3[2]}-${m3[3]}`);
    if (!isNaN(d4.getTime())) return d4.toISOString().slice(0, 10);
  }

  // Try native JS parse (handles ISO, RFC 2822, etc.)
  const d1 = new Date(value);
  if (!isNaN(d1.getTime())) return d1.toISOString().slice(0, 10);

  return null;
}

// ── Amount parsing ────────────────────────────────────────────────────────────

function parseAmount(value: string): number {
  return parseFloat(value.replace(/[,$£€\s]/g, "").trim());
}

// ── Apply mappings ─────────────────────────────────────────────────────────────

export function applyMappings(
  rows: string[][],
  mappings: ColumnMapping[]
): { transactions: ParsedTransaction[]; errors: string[] } {
  const transactions: ParsedTransaction[] = [];
  const errors: string[] = [];

  const dateCol   = mappings.find(m => m.role === "date");
  const descCol   = mappings.find(m => m.role === "description");
  const debitCol  = mappings.find(m => m.role === "debit");
  const creditCol = mappings.find(m => m.role === "credit");
  const amountCol = mappings.find(m => m.role === "amount");
  const refCol    = mappings.find(m => m.role === "reference");

  for (let i = 0; i < rows.length; i++) {
    const row    = rows[i];
    const rowNum = i + 2; // +1 for header row, +1 for 1-based display

    // Date
    const rawDate   = dateCol ? (row[dateCol.index] ?? "") : "";
    const valueDate = parseDate(rawDate);
    if (!valueDate) {
      errors.push(`Row ${rowNum}: unparseable date "${rawDate}"`);
      continue;
    }

    // Description
    const description = (descCol ? row[descCol.index] ?? "" : "").trim();

    // Amount
    let amount: number;
    if (debitCol && creditCol) {
      const credit = parseAmount(row[creditCol.index] ?? "0");
      const debit  = parseAmount(row[debitCol.index]  ?? "0");
      amount = (isNaN(credit) ? 0 : credit) - (isNaN(debit) ? 0 : debit);
    } else if (amountCol) {
      amount = parseAmount(row[amountCol.index] ?? "");
    } else {
      errors.push(`Row ${rowNum}: no amount column mapped`);
      continue;
    }

    if (isNaN(amount)) {
      errors.push(`Row ${rowNum}: unparseable amount`);
      continue;
    }

    const reference = (refCol ? row[refCol.index] ?? "" : "").trim();

    transactions.push({ valueDate, description, amount, reference });
  }

  return { transactions, errors };
}

// ── File parsing ──────────────────────────────────────────────────────────────

const MAX_ROWS = 10_000;

export async function parseFile(file: File): Promise<ParseResult> {
  let workbook: XLSX.WorkBook;

  if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
  } else {
    const text = await file.text();
    workbook = XLSX.read(text, { type: "string" });
  }

  const sheetName = workbook.SheetNames[0];
  const sheet     = workbook.Sheets[sheetName];
  const all: string[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw:    false,
    defval: "",
  }) as string[][];

  if (all.length === 0) {
    return { headers: [], rawRows: [], allDataRows: [], mappings: [], transactions: [], errors: ["File is empty"] };
  }

  const headers     = all[0].map(h => String(h));
  const allDataRows = all.slice(1);

  if (allDataRows.length > MAX_ROWS) {
    return {
      headers,
      rawRows:      allDataRows.slice(0, 5),
      allDataRows:  [],
      mappings:     [],
      transactions: [],
      errors: [`File exceeds ${MAX_ROWS.toLocaleString()} row limit (${allDataRows.length.toLocaleString()} rows found)`],
    };
  }

  const mappings               = detectColumns(headers);
  const { transactions, errors } = applyMappings(allDataRows, mappings);

  return {
    headers,
    rawRows:     allDataRows.slice(0, 5),
    allDataRows,
    mappings,
    transactions,
    errors,
  };
}
