import { ImportField } from "./fields";
import { coerceDate, coerceNumber, coercePercent, coerceString } from "./parse";
import { detectMonthColumns, buildMonthlyTargetsFromRow, BuiltMonthlyTarget, ParsedMonthColumns } from "./monthlyTargets";
import { ParsedColumn } from "./parse";

// Keyed by column INDEX (as a string, since object keys are always
// strings), not header text — real sheets repeat header text across
// sections (e.g. "SUPPLY AMT" under PO / Selling / Billed), so two
// distinct columns can share a name. Index is always unique.
export type ColumnMapping = Record<number, ImportField>;

export interface BuiltMilestone {
  label: string;
  percent: number;
  billedSupplyAmt: number;
  billedInstallationAmt: number;
  dueDate: string | null;
}
export interface BuiltCollection {
  amount: number;
}
export interface BuiltSubJob {
  name: string;
  poSupplyAmt: number;
  poInstallationAmt: number;
  sellingSupplyAmt: number;
  sellingErectionAmt: number;
  milestones: BuiltMilestone[];
  collections: BuiltCollection[];
}
export interface BuiltProject {
  name: string;
  jobCode: string | null;
  clientName: string | null;
  remarks: string | null;
  subJobs: BuiltSubJob[];
  monthlyTargets: BuiltMonthlyTarget[];
}

/**
 * The longest prefix shared by every name, cut at the last complete word
 * boundary and trimmed of trailing separators (" - ", "-", etc). Used to
 * derive a project name from a set of sub-job names like "SUPREME POWER -
 * ADMIN BUILDING" / "SUPREME POWER - FACTORY BUILDING" -> "SUPREME POWER".
 * Returns null if the names don't share a meaningful prefix (fewer than 3
 * characters, or they're identical — nothing to split).
 */
function commonNamePrefix(names: string[]): string | null {
  if (names.length < 2) return null;
  let prefix = names[0];
  for (const name of names.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < name.length && prefix[i].toLowerCase() === name[i].toLowerCase()) i++;
    prefix = prefix.slice(0, i);
    if (!prefix) return null;
  }
  // Cut back to the last word boundary so "SUPREME POWER - A" / "SUPREME
  // POWER - F" doesn't produce a prefix mid-word.
  const wordBoundary = prefix.search(/[\s\-–—]+$/);
  const trimmed = (wordBoundary >= 0 ? prefix.slice(0, wordBoundary) : prefix)
    .replace(/[\s\-–—]+$/, "")
    .trim();
  if (trimmed.length < 3) return null;
  if (names.every((n) => n.trim().toLowerCase() === trimmed.toLowerCase())) return null; // no real split happened
  return trimmed;
}

/**
 * Converts raw rows (arrays aligned to column index) + an index->field
 * mapping into a project/sub-job/milestone tree.
 *
 * Two grouping modes, chosen automatically per row-group:
 *
 * 1. Row-group mode (when a "groupNo" column is mapped — typically S.NO in
 *    a merged-cell sheet): rows sharing the same forward-filled group
 *    number belong to one project. If the group has more than one row with
 *    a *distinct* Project Name, each row's Project Name becomes a SUB-JOB
 *    name, and the overall project name is the longest common prefix those
 *    names share (e.g. "SUPREME POWER - ADMIN BUILDING" / "... - FACTORY
 *    BUILDING" -> project "SUPREME POWER", sub-jobs "Admin Building" /
 *    "Factory Building"). A single-row group just uses that row's own name
 *    as both project and sub-job name — no artificial split.
 *
 * 2. Plain mode (no groupNo mapped): falls back to grouping directly by
 *    (forward-filled) Project Name, as before — every row with the same
 *    project name is one sub-job unless a distinct Sub-job Name column is
 *    also mapped.
 *
 * Forward-fill applies to Project Name, Job Code, Client Name and the group
 * number itself, since spreadsheets that mirror merged cells leave those
 * blank on every row after the first.
 *
 * When several columns map to the same amount field (e.g. two columns both
 * mapped to poSupplyAmt), their values are SUMMED rather than the first one
 * silently winning.
 *
 * When `columns` is provided, monthly billing/collection target-vs-achieved
 * blocks (detected from section titles like "APR'26") are also extracted
 * and attached per project, taken from the first row of each row-group
 * (the Team Sheet only carries these values on a group's first row).
 */
export function buildProjectsFromRows(rows: unknown[][], mapping: ColumnMapping, columns?: ParsedColumn[]): BuiltProject[] {
  const monthColumns: ParsedMonthColumns[] = columns ? detectMonthColumns(columns) : [];
  const indicesFor = (field: ImportField): number[] =>
    Object.entries(mapping)
      .filter(([, mapped]) => mapped === field)
      .map(([idx]) => parseInt(idx, 10));

  const firstValueFor = (row: unknown[], field: ImportField): unknown => {
    for (const idx of indicesFor(field)) {
      const v = row[idx];
      if (v != null && v !== "") return v;
    }
    return null;
  };

  const summedNumberFor = (row: unknown[], field: ImportField): number =>
    indicesFor(field).reduce((sum, idx) => sum + coerceNumber(row[idx]), 0);

  const hasGroupNo = indicesFor("groupNo").length > 0;

  interface RowData {
    raw: unknown[];
    groupKey: string;
    rowName: string;
    jobCode: string | null;
    clientName: string | null;
    remarks: string | null;
    subJobNameOverride: string;
    poSupplyAmt: number;
    poInstallationAmt: number;
    sellingSupplyAmt: number;
    sellingErectionAmt: number;
    milestoneLabel: string;
    milestonePercent: number;
    billedSupplyAmt: number;
    billedInstallationAmt: number;
    dueDate: string | null;
    collectedAmt: number;
  }

  const parsedRows: RowData[] = [];
  let lastGroupNo = "";
  let lastProjectName = "";
  let lastJobCode: string | null = null;
  let lastClientName: string | null = null;

  for (const row of rows) {
    const rawGroupNo = coerceString(firstValueFor(row, "groupNo"));
    const groupNo = rawGroupNo || (hasGroupNo ? lastGroupNo : "");
    if (rawGroupNo) lastGroupNo = rawGroupNo;

    const rawProjectName = coerceString(firstValueFor(row, "projectName"));
    const rowName = rawProjectName || (hasGroupNo ? "" : lastProjectName);
    // In row-group mode a blank Project Name on a continuation row is fine
    // (it's a genuine additional sub-job row); in plain mode we need SOME
    // name via forward-fill to place the row at all.
    if (!hasGroupNo && !rowName) continue;
    if (rawProjectName) lastProjectName = rawProjectName;

    const rawJobCode = coerceString(firstValueFor(row, "jobCode"));
    const jobCode = rawJobCode || lastJobCode || null;
    if (rawJobCode) lastJobCode = rawJobCode;

    const rawClientName = coerceString(firstValueFor(row, "clientName"));
    const clientName = rawClientName || lastClientName || null;
    if (rawClientName) lastClientName = rawClientName;

    const remarks = coerceString(firstValueFor(row, "remarks")) || null;
    const subJobNameOverride = coerceString(firstValueFor(row, "subJobName"));

    if (hasGroupNo && !groupNo && !rowName) continue; // nothing to place this row under

    parsedRows.push({
      raw: row,
      groupKey: hasGroupNo ? groupNo || `__row${parsedRows.length}` : rowName,
      rowName,
      jobCode,
      clientName,
      remarks,
      subJobNameOverride,
      poSupplyAmt: summedNumberFor(row, "poSupplyAmt"),
      poInstallationAmt: summedNumberFor(row, "poInstallationAmt"),
      sellingSupplyAmt: summedNumberFor(row, "sellingSupplyAmt"),
      sellingErectionAmt: summedNumberFor(row, "sellingErectionAmt"),
      milestoneLabel: coerceString(firstValueFor(row, "milestoneLabel")),
      milestonePercent: coercePercent(firstValueFor(row, "milestonePercent")),
      billedSupplyAmt: summedNumberFor(row, "billedSupplyAmt"),
      billedInstallationAmt: summedNumberFor(row, "billedInstallationAmt"),
      dueDate: coerceDate(firstValueFor(row, "dueDate")),
      collectedAmt: summedNumberFor(row, "collectedAmt"),
    });
  }

  // Group rows by groupKey, preserving first-seen order.
  const groups = new Map<string, RowData[]>();
  for (const r of parsedRows) {
    if (!groups.has(r.groupKey)) groups.set(r.groupKey, []);
    groups.get(r.groupKey)!.push(r);
  }

  const projects: BuiltProject[] = [];

  for (const groupRows of groups.values()) {
    const distinctNames = [...new Set(groupRows.map((r) => r.rowName).filter(Boolean))];
    const jobCode = groupRows.find((r) => r.jobCode)?.jobCode ?? null;
    const clientName = groupRows.find((r) => r.clientName)?.clientName ?? null;
    const remarks = groupRows.find((r) => r.remarks)?.remarks ?? null;

    const isMultiSubJob = hasGroupNo && distinctNames.length > 1;
    const projectName = isMultiSubJob ? commonNamePrefix(distinctNames) ?? distinctNames[0] : distinctNames[0] || groupRows[0].groupKey;
    if (!projectName) continue;

    const monthlyTargets = monthColumns.length > 0 ? buildMonthlyTargetsFromRow(groupRows[0].raw, monthColumns) : [];
    const project: BuiltProject = { name: projectName, jobCode, clientName, remarks, subJobs: [], monthlyTargets };

    for (const row of groupRows) {
      const subJobName =
        row.subJobNameOverride || (isMultiSubJob ? titleCase(row.rowName.replace(projectName, "").replace(/^[\s\-–—]+/, "")) || row.rowName : row.rowName) || projectName;

      let subJob = project.subJobs.find((sj) => sj.name === subJobName);
      if (!subJob) {
        subJob = {
          name: subJobName,
          poSupplyAmt: row.poSupplyAmt,
          poInstallationAmt: row.poInstallationAmt,
          sellingSupplyAmt: row.sellingSupplyAmt,
          sellingErectionAmt: row.sellingErectionAmt,
          milestones: [],
          collections: [],
        };
        project.subJobs.push(subJob);
      }

      if (row.milestoneLabel || row.billedSupplyAmt > 0 || row.billedInstallationAmt > 0 || row.dueDate || row.milestonePercent > 0) {
        subJob.milestones.push({
          label: row.milestoneLabel || `Term ${subJob.milestones.length + 1}`,
          percent: row.milestonePercent,
          billedSupplyAmt: row.billedSupplyAmt,
          billedInstallationAmt: row.billedInstallationAmt,
          dueDate: row.dueDate,
        });
      }
      if (row.collectedAmt > 0) {
        subJob.collections.push({ amount: row.collectedAmt });
      }
    }

    projects.push(project);
  }

  return projects;
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}
