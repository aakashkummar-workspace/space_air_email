import * as XLSX from "xlsx";

// A column is identified by its position, not its header text — real-world
// sheets (like the Team Sheet) repeat header text ("SUPPLY AMT" 3x across
// PO/Selling/Billed sections), so header-as-key would collide columns
// together and silently drop data. `section` (when present) is the merged
// title above the header row — e.g. "AS PER PO" / "SELLING VALUE" / "ALREADY
// BILLED AMOUNT" — used to disambiguate which repeated header a column is.
export interface ParsedColumn {
  index: number;
  header: string;
  section: string | null;
}

export interface ParsedSheet {
  sheetName: string;
  columns: ParsedColumn[];
  rows: unknown[][]; // each row is an array aligned to `columns` by index
  headerRowIndex: number;
}

/**
 * Reads all sheets of a workbook and, for each, finds the most plausible
 * header row (the row with the most non-empty string-looking cells within
 * the first 10 rows — handles Team-Sheet-style files where row 1 is a
 * section title and row 2 is the real header, or simple single-header files).
 */
export function parseWorkbook(buffer: ArrayBuffer): ParsedSheet[] {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheets: ParsedSheet[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const grid: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: null });
    if (grid.length === 0) continue;

    const headerRowIndex = findHeaderRow(grid);
    const headerRow = grid[headerRowIndex] as unknown[];

    // The row directly above the header row often carries merged "section"
    // titles (Team-Sheet-style: "AS PER PO" spans several columns whose own
    // header is a repeated "SUPPLY AMT"/"INSTALLATION AMT"/etc). A merged
    // cell only has a value in its first (leftmost) column in the raw grid,
    // so forward-fill it across the columns it visually spans.
    const sectionRow = headerRowIndex > 0 ? (grid[headerRowIndex - 1] as unknown[]) : null;
    const sections: (string | null)[] = [];
    if (sectionRow) {
      let last: string | null = null;
      for (let i = 0; i < headerRow.length; i++) {
        const v = sectionRow[i];
        if (typeof v === "string" && v.trim() !== "") last = v.trim();
        sections[i] = last;
      }
    }

    const columns: ParsedColumn[] = headerRow.map((h, i) => ({
      index: i,
      header: h == null || String(h).trim() === "" ? `Column ${i + 1}` : String(h).trim(),
      section: sectionRow ? sections[i] : null,
    }));

    const rows: unknown[][] = [];
    for (let r = headerRowIndex + 1; r < grid.length; r++) {
      const rowArr = grid[r] as unknown[];
      if (!rowArr || rowArr.every((c) => c == null || c === "")) continue;
      rows.push(rowArr);
    }

    if (rows.length > 0) {
      sheets.push({ sheetName, columns, rows, headerRowIndex });
    }
  }

  return sheets;
}

function findHeaderRow(grid: unknown[][]): number {
  const scanLimit = Math.min(10, grid.length);
  let best = 0;
  let bestScore = -1;
  for (let r = 0; r < scanLimit; r++) {
    const row = grid[r] as unknown[];
    if (!row) continue;
    const score = row.filter((c) => typeof c === "string" && c.trim().length > 0 && isNaN(Number(c))).length;
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }
  return best;
}

export function coerceNumber(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const cleaned = String(v).replace(/[,₹\s]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

export function coerceDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "number") {
    // Excel serial date
    const parsed = XLSX.SSF.parse_date_code(v);
    if (parsed) return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d)).toISOString();
  }
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export function coercePercent(v: unknown): number {
  const n = coerceNumber(v);
  if (n === 0) return 0;
  return n > 1 ? n / 100 : n;
}

export function coerceString(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}
