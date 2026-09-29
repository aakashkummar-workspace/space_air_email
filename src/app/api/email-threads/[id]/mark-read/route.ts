import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const thread = await prisma.emailThread.update({ where: { id }, data: { unread: false } });
  return NextResponse.json(thread);
}
