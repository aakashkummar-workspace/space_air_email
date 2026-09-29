// The set of fields we can import into, and the alias vocabulary used to
// fuzzy-match arbitrary spreadsheet headers onto them. New aliases can be
// added here as real-world files reveal new naming conventions.

export type ImportField =
  | "groupNo"
  | "projectName"
  | "jobCode"
  | "clientName"
  | "subJobName"
  | "poSupplyAmt"
  | "poInstallationAmt"
  | "sellingSupplyAmt"
  | "sellingErectionAmt"
  | "milestoneLabel"
  | "milestonePercent"
  | "billedSupplyAmt"
  | "billedInstallationAmt"
  | "dueDate"
  | "collectedAmt"
  | "remarks"
  | "ignore";

export const IMPORT_FIELDS: { key: ImportField; label: string; group: string; required?: boolean }[] = [
  { key: "groupNo", label: "Row Group No. (S.No)", group: "Project" },
  { key: "projectName", label: "Project Name", group: "Project", required: true },
  { key: "jobCode", label: "Job Code", group: "Project" },
  { key: "clientName", label: "Client Name", group: "Project" },
  { key: "remarks", label: "Remarks", group: "Project" },
  { key: "subJobName", label: "Sub-job Name", group: "Sub-job" },
  { key: "poSupplyAmt", label: "PO — Supply Amount", group: "PO / Contract" },
  { key: "poInstallationAmt", label: "PO — Installation Amount", group: "PO / Contract" },
  { key: "sellingSupplyAmt", label: "Selling Value — Supply", group: "Selling Value" },
  { key: "sellingErectionAmt", label: "Selling Value — Erection", group: "Selling Value" },
  { key: "milestoneLabel", label: "Milestone / Term Label", group: "Milestone" },
  { key: "milestonePercent", label: "Milestone %", group: "Milestone" },
  { key: "billedSupplyAmt", label: "Billed — Supply", group: "Billing" },
  { key: "billedInstallationAmt", label: "Billed — Installation", group: "Billing" },
  { key: "dueDate", label: "Due Date", group: "Milestone" },
  { key: "collectedAmt", label: "Collected / Payment Received", group: "Collection" },
  { key: "ignore", label: "— Ignore this column —", group: "" },
];

// Lowercased, punctuation-stripped alias -> field. Matching normalizes the
// header the same way before lookup. Used only when a column has no
// (or an unrecognized) section context — see guessField.
const ALIASES: Record<string, ImportField> = {
  // project
  "project name": "projectName",
  "project detail": "projectName",
  "project": "projectName",
  "client": "clientName",
  "client name": "clientName",
  "job code": "jobCode",
  "jobcode": "jobCode",
  "po no": "jobCode",
  "remarks": "remarks",
  "notes": "remarks",
  // sub-job
  "sub job name": "subJobName",
  "subjob": "subJobName",
  "sub job": "subJobName",
  "building": "subJobName",
  // PO
  "supply amt": "poSupplyAmt",
  "po supply amt": "poSupplyAmt",
  "as per po supply amt": "poSupplyAmt",
  "installation amt": "poInstallationAmt",
  "po installation amt": "poInstallationAmt",
  "total po amt": "ignore",
  "po value": "poSupplyAmt",
  "po amount": "poSupplyAmt",
  // selling
  "selling value supply amt": "sellingSupplyAmt",
  "selling supply amt": "sellingSupplyAmt",
  "erection amt": "sellingErectionAmt",
  "selling erection amt": "sellingErectionAmt",
  "total selling amt": "ignore",
  // milestone
  "payment terms": "milestoneLabel",
  "milestone": "milestoneLabel",
  "term": "milestoneLabel",
  "percent": "milestonePercent",
  "%": "milestonePercent",
  // billed
  "already billed amount supply amt": "billedSupplyAmt",
  "billed supply amt": "billedSupplyAmt",
  "billed value": "billedSupplyAmt",
  "billed installation amt": "billedInstallationAmt",
  "already billed amount installation amt": "billedInstallationAmt",
  "total billed amt": "ignore",
  // due date
  "due date": "dueDate",
  "payment due date": "dueDate",
  "due": "dueDate",
  // collection
  "collection received": "collectedAmt",
  "collected": "collectedAmt",
  "payment received": "collectedAmt",
  "amount received": "collectedAmt",
  // s.no / row numbers — this is the grouping key for sheets where several
  // rows (one per sub-job) share the same S.NO via a merged cell, and only
  // the PROJECT NAME differs row to row (see buildProjectsFromRows).
  "s no": "groupNo",
  "sno": "groupNo",
  "sl no": "groupNo",
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[_\-./]/g, " ")
    .replace(/[^a-z0-9%\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Section-title keywords (from a merged header row like "AS PER PO" /
// "SELLING VALUE" / "ALREADY BILLED AMOUNT" / "TO BE BILL (UNBILLED
// AMOUNT)" / "OUTSTANDING AMOUNT") mapped to which amount-field family a
// generic "SUPPLY AMT" / "INSTALLATION AMT" / "ERECTION AMT" column
// underneath them actually means. `null` means "this whole section is
// derived/summary data — ignore columns under it regardless of their own
// header text" (unbilled and outstanding are both computed by the app,
// never imported as raw numbers).
type AmountFamily = { supply: ImportField; installOrErection: ImportField } | null;

const SECTION_AMOUNT_FAMILY: [RegExp, AmountFamily][] = [
  [/unbilled|to\s*be\s*bill/, null],
  [/outstanding/, null],
  [/payment\s*terms/, null], // "AS PER PAYMENT TERMS" selling-value-times-percent columns — derived, not a distinct input
  [/selling/, { supply: "sellingSupplyAmt", installOrErection: "sellingErectionAmt" }],
  [/already\s*billed|billed\s*amount/, { supply: "billedSupplyAmt", installOrErection: "billedInstallationAmt" }],
  [/as\s*per\s*po|^po\b|contract/, { supply: "poSupplyAmt", installOrErection: "poInstallationAmt" }],
];

function familyForSection(section: string | null): AmountFamily | undefined {
  if (!section) return undefined;
  const norm = normalize(section);
  for (const [re, family] of SECTION_AMOUNT_FAMILY) {
    if (re.test(norm)) return family;
  }
  return undefined;
}

// Header names generic/ambiguous enough that section context should decide
// them. A column with its own distinctive name (PAYMENT TERMS, COLLECTION
// RECEIVED, ...) is never overridden by section, even when it happens to
// sit under a section whose OTHER columns are derived/ignorable — sheets
// don't reliably give every column its own section title, so a name that
// clearly means something specific should win over an inherited section.
const GENERIC_AMOUNT_HEADER = /^(supply\s*amt|installation\s*amt|erection\s*amt|total\b.*)$/;

/**
 * Attempt to guess the ImportField for a raw spreadsheet header, optionally
 * disambiguated by the merged "section" title above it (e.g. a repeated
 * "SUPPLY AMT" column means something different under "AS PER PO" than
 * under "SELLING VALUE" or "ALREADY BILLED AMOUNT") and by a sample of its
 * actual cell values (a column literally named "PAYMENT TERMS" sometimes
 * holds a percentage like 0.2 rather than a text label — number-typed
 * samples under a name that would otherwise guess milestoneLabel are
 * redirected to milestonePercent instead).
 */
export function guessField(rawHeader: string, section?: string | null, sampleValues?: unknown[]): ImportField {
  const norm = normalize(rawHeader);
  if (!norm) return "ignore";

  // Section context only overrides the generic recurring amount-column
  // names — a distinctively-named column (PAYMENT TERMS, COLLECTION
  // RECEIVED) always falls through to alias/heuristic matching below,
  // regardless of which section it visually sits under.
  if (GENERIC_AMOUNT_HEADER.test(norm)) {
    const family = familyForSection(section ?? null);
    if (family !== undefined) {
      if (family === null) return "ignore"; // whole section is derived/summary
      if (/^supply\s*amt$/.test(norm)) return family.supply;
      if (/^(installation|erection)\s*amt$/.test(norm)) return family.installOrErection;
      if (/^total\b/.test(norm)) return "ignore"; // "TOTAL PO AMT" / "TOTAL SELLING AMT" / "TOTAL BILLED AMT"
    }
  }

  let guess: ImportField | undefined;
  if (ALIASES[norm]) guess = ALIASES[norm];

  // substring heuristics, ordered most-specific first — used when there's
  // no section context, or the section didn't match a known family above
  const heuristics: [RegExp, ImportField][] = [
    [/project|job\s*name/, "projectName"],
    [/job\s*code/, "jobCode"],
    [/client/, "clientName"],
    [/sub\s*job|building|block/, "subJobName"],
    [/selling.*supply|supply.*selling/, "sellingSupplyAmt"],
    [/selling.*erection|erection/, "sellingErectionAmt"],
    [/billed.*supply|supply.*billed/, "billedSupplyAmt"],
    [/billed.*install|install.*billed/, "billedInstallationAmt"],
    [/po.*supply|supply.*po/, "poSupplyAmt"],
    [/po.*install|install.*po/, "poInstallationAmt"],
    [/due\s*date/, "dueDate"],
    [/percent|%/, "milestonePercent"],
    [/collect|received|payment received/, "collectedAmt"],
    [/term|milestone|payment\s*terms/, "milestoneLabel"],
    [/po\b/, "poSupplyAmt"],
    [/remark|note/, "remarks"],
  ];
  if (!guess) {
    for (const [re, field] of heuristics) {
      if (re.test(norm)) {
        guess = field;
        break;
      }
    }
  }
  if (!guess) return "ignore";

  // A column guessed as a text label but whose actual sample values are all
  // numbers (0 < n <= 1, or a whole percent like 20) is a percent column
  // wearing a "term"/"payment terms" name, not a label — redirect it.
  if (guess === "milestoneLabel" && sampleValues && sampleValues.length > 0) {
    const nonEmpty = sampleValues.filter((v) => v != null && v !== "");
    const allNumeric = nonEmpty.length > 0 && nonEmpty.every((v) => typeof v === "number");
    if (allNumeric) return "milestonePercent";
  }

  return guess;
}

export function fieldLabel(field: ImportField): string {
  return IMPORT_FIELDS.find((f) => f.key === field)?.label ?? field;
}
