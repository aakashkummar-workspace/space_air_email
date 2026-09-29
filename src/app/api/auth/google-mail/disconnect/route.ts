import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function POST() {
  const account = await prisma.googleMailAccount.findFirst();
  await prisma.googleMailAccount.deleteMany({});
  if (account) {
    await logAudit({
      action: "delete",
      entityType: "GoogleMailAccount",
      entityId: account.email,
      summary: `Disconnected Google account "${account.email}"`,
    });
  }
  return NextResponse.json({ ok: true });
}
