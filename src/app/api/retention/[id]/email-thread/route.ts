import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const threads = await prisma.emailThread.findMany({
    where: { retentionInstallmentId: id },
    orderBy: { createdAt: "desc" },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        include: { attachments: true, sentByUser: { select: { name: true, email: true } } },
      },
    },
  });
  return NextResponse.json(threads);
}
