import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["ADMIN", "FINANCE", "PM"]).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const user = await prisma.user.update({
    where: { id },
    data: parsed.data,
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
  await logAudit({ action: "update", entityType: "User", entityId: user.id, summary: `Updated user "${user.name}" (role: ${user.role})` });
  return NextResponse.json(user);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id } });
  const remainingAdmins = await prisma.user.count({ where: { role: "ADMIN", id: { not: id } } });
  if (user?.role === "ADMIN" && remainingAdmins === 0) {
    return NextResponse.json({ error: "Cannot delete the last admin account." }, { status: 400 });
  }
  await prisma.user.delete({ where: { id } });
  if (user) {
    await logAudit({ action: "delete", entityType: "User", entityId: id, summary: `Deleted user "${user.name}"` });
  }
  return NextResponse.json({ ok: true });
}
