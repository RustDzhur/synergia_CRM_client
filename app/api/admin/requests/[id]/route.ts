import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { notFound, validId } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// PATCH /api/admin/requests/:id — { status: "new" | "done" }
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const admin = await requirePlatformAdmin(req);
    if (!admin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    if (!validId(params.id)) return notFound();
    const b = await req.json().catch(() => ({}));
    const found = await prisma.invoiceRequest.findUnique({ where: { id: params.id } });
    if (!found) return notFound();
    await prisma.invoiceRequest.update({ where: { id: found.id }, data: { status: b?.status === "new" ? "new" : "done" } });
    return NextResponse.json({ ok: true });
}
