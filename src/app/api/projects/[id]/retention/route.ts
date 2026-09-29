import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const createSchema = z.object({
  label: z.string().min(1).default("Retention"),
  amount: z.number().min(0),
  dueDate: z.string().datetime().nullable().optional(),
  remarks: z.string().optional(),
  autoSendEmail: z.boolean().default(false),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const installments = await prisma.retentionInstallment.findMany({
    where: { projectId: id },
    orderBy: { dueDate: "asc" },
  });
  return NextResponse.json(installments);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { dueDate, ...rest } = parsed.data;
  const installment = await prisma.retentionInstallment.create({
    data: { ...rest, projectId: id, dueDate: dueDate ? new Date(dueDate) : null },
  });
  await logAudit({
    action: "create",
    entityType: "RetentionInstallment",
    entityId: installment.id,
    summary: `Added retention installment "${installment.label}" (₹${installment.amount.toLocaleString("en-IN")})`,
  });
  return NextResponse.json(installment, { status: 201 });
}
