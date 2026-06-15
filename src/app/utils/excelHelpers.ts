import ExcelJS from "exceljs";

export function cellValue(cell: ExcelJS.Cell, raw = true): unknown {
  const v = cell.value;
  if (v === null || v === undefined) return raw ? null : "";

  if (typeof v === "object" && ("formula" in v || "sharedFormula" in v)) {
    const result = (v as ExcelJS.CellFormulaValue).result;
    if (result === null || result === undefined) return raw ? null : "";
    if (result instanceof Error) return raw ? null : "";
    return cellValue({ ...cell, value: result } as unknown as ExcelJS.Cell, raw);
  }

  if (typeof v === "object" && "richText" in v) {
    const text = (v as ExcelJS.CellRichTextValue).richText
      .map((rt) => rt.text)
      .join("");
    return text;
  }

  if (typeof v === "object" && "hyperlink" in v) {
    const text = (v as ExcelJS.CellHyperlinkValue).text ?? "";
    return text;
  }

  if (typeof v === "object" && "error" in v) return raw ? null : "";

  if (v instanceof Date) {
    if (raw) return v;
    return v.toISOString().slice(0, 10);
  }

  if (!raw) return String(v);
  return v;
}

export function worksheetToMatrix(
  ws: ExcelJS.Worksheet,
  raw = true,
): unknown[][] {
  const ncols = ws.columnCount || 1;
  const matrix: unknown[][] = [];

  ws.eachRow({ includeEmpty: true }, (row) => {
    const values: unknown[] = [];
    for (let c = 1; c <= Math.max(ncols, row.cellCount); c++) {
      values.push(cellValue(row.getCell(c), raw));
    }
    matrix.push(values);
  });

  return matrix;
}

export async function loadXlsx(buffer: ArrayBuffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return wb;
}

export async function xlsxToBuffer(wb: ExcelJS.Workbook): Promise<ArrayBuffer> {
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

export async function xlsxDownload(
  wb: ExcelJS.Workbook,
  filename: string,
): Promise<void> {
  const buf = await xlsxToBuffer(wb);
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function xlsxToBlob(wb: ExcelJS.Workbook): Promise<Blob> {
  const buf = await xlsxToBuffer(wb);
  return new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
