import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// DELETE /api/onedrive — отключить OneDrive. Перенесённые документы остаются в CRM, ссылки на них работают.
export async function DELETE(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    await prisma.integration.deleteMany({ where: { owner: user.id, type: "onedrive" } });
    return NextResponse.json({ ok: true });
}
