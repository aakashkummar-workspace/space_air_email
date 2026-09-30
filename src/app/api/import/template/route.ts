import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

// A blank import template whose headers match the importer's field
// aliases exactly (see src/lib/import/fields.ts ALIASES), so every column
// auto-maps with no ambiguity when re-uploaded. One row per milestone —
// give two rows the same Project Name to add a second milestone/sub-job
// under the same project.
const HEADERS = [
  "Project Name",
  "Client Name",
  "Job Code",
  "Sub-job Name",
  "PO Supply Amt",
  "PO Installation Amt",
  "Selling Supply Amt",
  "Selling Erection Amt",
  "Milestone Label",
  "Milestone %",
  "Billed Supply Amt",
  "Billed Installation Amt",
  "Due Date",
  "Amount Received",
  "Remarks",
];

const EXAMPLE_ROW = [
  "Example Project",
  "Example Client Pvt Ltd",
  "SAP/TN/25-26/P001",
  "Example Project", // Sub-job Name — same as Project Name for a single-job project
  1000000,
  100000,
  1000000,
  100000,
  "Advance — 20%",
  20,
  200000,
  20000,
  "2026-12-31",
  200000,
  "Optional notes",
];

export async function GET() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([HEADERS, EXAMPLE_ROW]);

  ws["!cols"] = HEADERS.map((h) => ({ wch: Math.max(h.length + 2, 16) }));

  XLSX.utils.book_append_sheet(wb, ws, "Projects");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="project-import-template.xlsx"',
    },
  });
}
