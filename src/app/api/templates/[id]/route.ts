import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit, computeDiff } from "@/lib/audit";
import { z } from "zod";

const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  subject: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  category: z.enum(["MILESTONE", "RETENTION"]).optional(),
  toRecipients: z.string().optional(),
  ccRecipients: z.string().optional(),
  bccRecipients: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = updateTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const before = await prisma.emailTemplate.findUnique({ where: { id } });
  const template = await prisma.emailTemplate.update({ where: { id }, data: parsed.data });

  if (before) {
    const diff = computeDiff(before, parsed.data);
    if (Object.keys(diff).length > 0) {
      await logAudit({
        action: "update",
        entityType: "EmailTemplate",
        entityId: template.id,
        summary: `Updated email template "${template.name}" (${Object.keys(diff).join(", ")})`,
        diff,
      });
    }
  }
  return NextResponse.json(template);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const template = await prisma.emailTemplate.findUnique({ where: { id } });
  await prisma.emailTemplate.delete({ where: { id } });
  if (template) {
    await logAudit({
      action: "delete",
      entityType: "EmailTemplate",
      entityId: id,
      summary: `Deleted email template "${template.name}"`,
    });
  }
  return NextResponse.json({ ok: true });
}
