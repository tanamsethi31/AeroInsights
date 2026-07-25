export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  while (i < n) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < n && text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(cell);
        cell = "";
      } else if (ch === '\r' || ch === '\n') {
        if (ch === '\r' && i + 1 < n && text[i + 1] === '\n') i++;
        row.push(cell);
        cell = "";
        if (row.some(c => c !== "")) rows.push(row);
        row = [];
      } else {
        cell += ch;
      }
    }
    i++;
  }

  if (cell !== "" || row.length > 0) {
    row.push(cell);
    if (row.some(c => c !== "")) rows.push(row);
  }

  return rows;
}
