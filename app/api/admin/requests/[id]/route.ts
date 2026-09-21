import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { notFound, validId } from "@/lib/api";
import InvoiceRequest from "@/models/InvoiceRequest";

export const dynamic = "force-dynamic";

// PATCH /api/admin/requests/:id — { status: "new" | "done" }
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const admin = await requirePlatformAdmin(req);
    if (!admin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    if (!validId(params.id)) return notFound();
    const b = await req.json().catch(() => ({}));
    const r = await InvoiceRequest.findByIdAndUpdate(params.id, { status: b?.status === "new" ? "new" : "done" });
    return r ? NextResponse.json({ ok: true }) : notFound();
}
