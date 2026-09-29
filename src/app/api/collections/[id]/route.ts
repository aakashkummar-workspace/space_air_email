import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const collection = await prisma.collection.findUnique({ where: { id } });
  await prisma.collection.delete({ where: { id } });
  if (collection) {
    await logAudit({
      action: "delete",
      entityType: "Collection",
      entityId: id,
      summary: `Deleted collection of ₹${collection.amount.toLocaleString('en-IN')}`,
    });
  }
  return NextResponse.json({ ok: true });
}
