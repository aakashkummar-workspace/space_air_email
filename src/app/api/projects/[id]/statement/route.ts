import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { computeDueStatus } from "@/lib/billing";
import { StatementDocument } from "./StatementDocument";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      subJobs: {
        include: {
          milestones: {
            orderBy: { sequence: "asc" },
            include: { reminderLogs: { include: { reminderStage: true }, orderBy: { sentAt: "desc" } } },
          },
          collections: { orderBy: { receivedOn: "desc" } },
        },
      },
    },
  });

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buffer = await renderToBuffer(StatementDocument({ project, computeDueStatus }));

  const slug = project.name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `statement-${slug || project.id}-${dateStr}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
