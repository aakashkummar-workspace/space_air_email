import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

// A comma-separated list so a project can have multiple email recipients
// (e.g. accounts + site contact) — each entry must be a valid email once
// trimmed. Mirrors the same pattern used by the project-update route.
const emailListSchema = z
  .string()
  .refine(
    (v) => v.split(",").map((s) => s.trim()).filter(Boolean).every((s) => z.string().email().safeParse(s).success),
    { message: "Enter one or more valid, comma-separated email addresses." }
  )
  .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean).join(", "));

const createProjectSchema = z.object({
  name: z.string().min(1),
  clientName: z.string().optional(),
  clientEmail: emailListSchema.optional().or(z.literal("")),
  jobCode: z.string().optional(),
  remarks: z.string().optional(),
  currency: z.string().default("INR"),
});

export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      subJobs: {
        include: { milestones: true, collections: true },
      },
    },
  });
  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const project = await prisma.project.create({
    data: parsed.data,
    include: { subJobs: { include: { milestones: true, collections: true } } },
  });
  await logAudit({
    action: "create",
    entityType: "Project",
    entityId: project.id,
    summary: `Created project "${project.name}"`,
  });
  return NextResponse.json(project, { status: 201 });
}
