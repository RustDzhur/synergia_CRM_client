import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import InvoiceRequest from "@/models/InvoiceRequest";
import Organization from "@/models/Organization";

export const dynamic = "force-dynamic";

// GET /api/admin/requests — запросы счёта на банковский перевод (новые сверху)
export async function GET(req: Request) {
    const admin = await requirePlatformAdmin(req);
    if (!admin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    const list = await InvoiceRequest.find({}).sort({ status: 1, createdAt: -1 }).limit(100);
    const orgs = await Organization.find({ _id: { $in: list.map((r) => r.org) } }).select("name");
    return NextResponse.json(list.map((r) => ({ id: String(r._id), orgId: String(r.org), orgName: orgs.find((o) => String(o._id) === String(r.org))?.name ?? "", email: r.email, plan: r.plan, interval: r.interval, company: r.company, vatId: r.vatId, note: r.note, status: r.status, createdAt: r.createdAt.toISOString() })));
}
