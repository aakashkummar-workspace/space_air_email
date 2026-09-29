import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const bulkSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("setStatus"),
    projectIds: z.array(z.string()).min(1),
    status: z.enum(["ACTIVE", "ON_HOLD", "COMPLETED"]),
  }),
  z.object({
    action: z.literal("shiftDueDates"),
    projectIds: z.array(z.string()).min(1),
    days: z.number().int(),
  }),
  z.object({
    action: z.literal("delete"),
    projectIds: z.array(z.string()).min(1),
  }),
]);

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  if (data.action === "setStatus") {
    const result = await prisma.project.updateMany({
      where: { id: { in: data.projectIds } },
      data: { status: data.status },
    });
    await logAudit({
      action: "update",
      entityType: "Project",
      entityId: data.projectIds.join(","),
      summary: `Bulk-set status to ${data.status} on ${result.count} project(s)`,
    });
    return NextResponse.json({ updated: result.count });
  }

  if (data.action === "shiftDueDates") {
    const subJobs = await prisma.subJob.findMany({
      where: { projectId: { in: data.projectIds } },
      include: { milestones: true },
    });
    let updated = 0;
    for (const sj of subJobs) {
      for (const m of sj.milestones) {
        if (!m.dueDate) continue;
        const newDate = new Date(m.dueDate);
        newDate.setDate(newDate.getDate() + data.days);
        await prisma.milestone.update({ where: { id: m.id }, data: { dueDate: newDate } });
        updated++;
      }
    }
    await logAudit({
      action: "update",
      entityType: "Milestone",
      entityId: data.projectIds.join(","),
      summary: `Bulk-shifted ${updated} milestone due date(s) by ${data.days > 0 ? "+" : ""}${data.days} day(s)`,
    });
    return NextResponse.json({ updated });
  }

  if (data.action === "delete") {
    const projects = await prisma.project.findMany({ where: { id: { in: data.projectIds } } });
    const result = await prisma.project.deleteMany({ where: { id: { in: data.projectIds } } });
    await logAudit({
      action: "delete",
      entityType: "Project",
      entityId: data.projectIds.join(","),
      summary: `Bulk-deleted ${result.count} project(s): ${projects.map((p) => p.name).join(", ")}`,
    });
    return NextResponse.json({ deleted: result.count });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
