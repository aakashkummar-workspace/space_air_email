import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { subJobTotals } from "@/lib/billing";

export async function GET() {
  const projects = await prisma.project.findMany({
    include: {
      subJobs: {
        include: { milestones: { orderBy: { sequence: "asc" } }, collections: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const rows: Record<string, unknown>[] = [];

  for (const project of projects) {
    for (const subJob of project.subJobs) {
      const totals = subJobTotals(subJob);
      if (subJob.milestones.length === 0) {
        rows.push({
          "Project Name": project.name,
          "Job Code": project.jobCode ?? "",
          "Client Name": project.clientName ?? "",
          "Sub-job Name": subJob.name,
          "PO Supply Amt": subJob.poSupplyAmt,
          "PO Installation Amt": subJob.poInstallationAmt,
          "Selling Supply Amt": subJob.sellingSupplyAmt,
          "Selling Erection Amt": subJob.sellingErectionAmt,
          "Milestone Label": "",
          "Milestone %": "",
          "Billed Supply Amt": "",
          "Billed Installation Amt": "",
          "Due Date": "",
          "Collected Amt": totals.collected || "",
          Remarks: project.remarks ?? "",
        });
        continue;
      }
      subJob.milestones.forEach((m, i) => {
        rows.push({
          "Project Name": i === 0 ? project.name : "",
          "Job Code": i === 0 ? project.jobCode ?? "" : "",
          "Client Name": i === 0 ? project.clientName ?? "" : "",
          "Sub-job Name": i === 0 ? subJob.name : "",
          "PO Supply Amt": i === 0 ? subJob.poSupplyAmt : "",
          "PO Installation Amt": i === 0 ? subJob.poInstallationAmt : "",
          "Selling Supply Amt": i === 0 ? subJob.sellingSupplyAmt : "",
          "Selling Erection Amt": i === 0 ? subJob.sellingErectionAmt : "",
          "Milestone Label": m.label,
          "Milestone %": m.percent,
          "Billed Supply Amt": m.billedSupplyAmt,
          "Billed Installation Amt": m.billedInstallationAmt,
          "Due Date": m.dueDate ? m.dueDate.toISOString().slice(0, 10) : "",
          "Collected Amt": i === 0 ? totals.collected || "" : "",
          Remarks: i === 0 ? project.remarks ?? "" : "",
        });
      });
    }
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 26 }, { wch: 18 }, { wch: 18 }, { wch: 22 },
    { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
    { wch: 18 }, { wch: 10 }, { wch: 14 }, { wch: 16 },
    { wch: 12 }, { wch: 14 }, { wch: 28 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Projects");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="billing-export-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
