import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const templateSchema = z.object({
  name: z.string().min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
  category: z.enum(["MILESTONE", "RETENTION"]).default("MILESTONE"),
  toRecipients: z.string().default(""),
  ccRecipients: z.string().default(""),
  bccRecipients: z.string().default(""),
});

export async function GET() {
  const templates = await prisma.emailTemplate.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = templateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const template = await prisma.emailTemplate.create({ data: parsed.data });
  await logAudit({
    action: "create",
    entityType: "EmailTemplate",
    entityId: template.id,
    summary: `Added email template "${template.name}"`,
  });
  return NextResponse.json(template, { status: 201 });
}
