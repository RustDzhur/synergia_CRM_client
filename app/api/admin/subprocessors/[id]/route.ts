import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// DELETE — отметить, что субподрядчик больше не обрабатывает данные (запись остаётся в журнале с датой)
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    if (!(await requirePlatformAdmin(req))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    const r = await prisma.subprocessor.updateMany({ where: { id: params.id, removedAt: null }, data: { removedAt: new Date() } });
    return r.count ? NextResponse.json({ ok: true }) : NextResponse.json({ message: "Not found" }, { status: 404 });
}
