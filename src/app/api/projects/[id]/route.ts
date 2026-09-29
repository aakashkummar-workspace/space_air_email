import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit, computeDiff } from "@/lib/audit";
import { z } from "zod";

// clientEmail stores a comma-separated list so a project can have multiple
// recipients (e.g. accounts + site contact) — each entry must be a valid
// email once trimmed.
const emailListSchema = z
  .string()
  .refine(
    (v) => v.split(",").map((s) => s.trim()).filter(Boolean).every((s) => z.string().email().safeParse(s).success),
    { message: "Enter one or more valid, comma-separated email addresses." }
  )
  .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean).join(", "));

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  clientName: z.string().nullable().optional(),
  clientEmail: emailListSchema.nullable().optional().or(z.literal("")),
  jobCode: z.string().nullable().optional(),
  remarks: z.string().nullable().optional(),
  status: z.enum(["ACTIVE", "ON_HOLD", "COMPLETED"]).optional(),
  currency: z.string().optional(),
});

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
      retentionInstallments: { orderBy: { dueDate: "asc" } },
    },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(project);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = updateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const before = await prisma.project.findUnique({ where: { id } });
  const project = await prisma.project.update({ where: { id }, data: parsed.data });

  if (before) {
    const diff = computeDiff(before, parsed.data);
    if (Object.keys(diff).length > 0) {
      await logAudit({
        action: "update",
        entityType: "Project",
        entityId: project.id,
        summary: `Updated project "${project.name}" (${Object.keys(diff).join(", ")})`,
        diff,
      });
    }
  }
  return NextResponse.json(project);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });
  await prisma.project.delete({ where: { id } });
  if (project) {
    await logAudit({
      action: "delete",
      entityType: "Project",
      entityId: id,
      summary: `Deleted project "${project.name}"`,
    });
  }
  return NextResponse.json({ ok: true });
}
