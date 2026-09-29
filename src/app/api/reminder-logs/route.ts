import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const logs = await prisma.reminderLog.findMany({
    orderBy: { sentAt: "desc" },
    include: {
      reminderStage: { include: { template: true } },
      milestone: { include: { subJob: { include: { project: true } } } },
    },
    take: 200,
  });
  return NextResponse.json(logs);
}
