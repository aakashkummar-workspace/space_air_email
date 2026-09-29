import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const createCollectionSchema = z.object({
  amount: z.number(),
  receivedOn: z.string().datetime().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = createCollectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { receivedOn, ...rest } = parsed.data;
  const collection = await prisma.collection.create({
    data: { ...rest, subJobId: id, receivedOn: receivedOn ? new Date(receivedOn) : new Date() },
  });
  await logAudit({
    action: "create",
    entityType: "Collection",
    entityId: collection.id,
    summary: `Added collection of ₹${collection.amount.toLocaleString('en-IN')} to sub-job`,
  });
  return NextResponse.json(collection, { status: 201 });
}
