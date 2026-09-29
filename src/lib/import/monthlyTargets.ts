import { ParsedColumn } from "./parse";
import { coerceNumber } from "./parse";

export interface ParsedMonthColumns {
  month: number; // 1-12
  year: number;
  billingTargetIdx: number | null;
  billingAchievedIdx: number | null;
  collectionTargetIdx: number | null;
  collectionAchievedIdx: number | null;
}

const MONTH_NAMES: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

/**
 * Detects month-block sections from column section titles like "APR'26",
 * "MAY 2026", "June-26" etc, and locates the billing/collection
 * target/achieved columns within each block. A block is any run of columns
 * sharing the same section title (section is forward-filled by the parser
 * the same way as other section headers).
 */
export function detectMonthColumns(columns: ParsedColumn[]): ParsedMonthColumns[] {
  const blocks = new Map<string, ParsedColumn[]>();
  for (const col of columns) {
    if (!col.section) continue;
    const parsed = parseMonthSection(col.section);
    if (!parsed) continue;
    const key = `${parsed.year}-${parsed.month}`;
    if (!blocks.has(key)) blocks.set(key, []);
    blocks.get(key)!.push(col);
  }

  const result: ParsedMonthColumns[] = [];
  for (const [key, cols] of blocks) {
    const [year, month] = key.split("-").map(Number);
    const find = (re: RegExp) => cols.find((c) => re.test(normalize(c.header)))?.index ?? null;
    result.push({
      month,
      year,
      billingTargetIdx: find(/billing.*target/),
      billingAchievedIdx: find(/billing.*achiev/),
      collectionTargetIdx: find(/collection.*target/),
      collectionAchievedIdx: find(/collection.*achiev/),
    });
  }

  return result.sort((a, b) => a.year - b.year || a.month - b.month);
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function parseMonthSection(section: string): { month: number; year: number } | null {
  const norm = normalize(section);
  const match = norm.match(/([a-z]+)\s*'?\s*(\d{2,4})/);
  if (!match) return null;
  const monthName = match[1];
  const month = MONTH_NAMES[monthName];
  if (!month) return null;
  let year = parseInt(match[2], 10);
  if (year < 100) year += 2000;
  return { month, year };
}

export interface BuiltMonthlyTarget {
  month: number;
  year: number;
  billingTarget: number;
  billingAchieved: number;
  collectionTarget: number;
  collectionAchieved: number;
}

/**
 * Extracts one project's monthly targets from its row(s). Only the first
 * row of a project's row-group carries these values in the Team Sheet
 * layout (they're project-level, not per-sub-job), so pass just that row.
 */
export function buildMonthlyTargetsFromRow(row: unknown[], monthColumns: ParsedMonthColumns[]): BuiltMonthlyTarget[] {
  const targets: BuiltMonthlyTarget[] = [];
  for (const mc of monthColumns) {
    const billingTarget = mc.billingTargetIdx != null ? coerceNumber(row[mc.billingTargetIdx]) : 0;
    const billingAchieved = mc.billingAchievedIdx != null ? coerceNumber(row[mc.billingAchievedIdx]) : 0;
    const collectionTarget = mc.collectionTargetIdx != null ? coerceNumber(row[mc.collectionTargetIdx]) : 0;
    const collectionAchieved = mc.collectionAchievedIdx != null ? coerceNumber(row[mc.collectionAchievedIdx]) : 0;
    if (billingTarget || billingAchieved || collectionTarget || collectionAchieved) {
      targets.push({ month: mc.month, year: mc.year, billingTarget, billingAchieved, collectionTarget, collectionAchieved });
    }
  }
  return targets;
}
