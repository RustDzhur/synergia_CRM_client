import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { nextNumber } from "@/lib/finance/numbering";
import { toContractDTO } from "@/lib/finance/dto";
import Contract from "@/models/Contract";
import User from "@/models/User";

export const dynamic = "force-dynamic";

// GET /api/contracts?status= — договоры фирмы, самые новые первыми
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    await connectDB();
    const status = new URL(req.url).searchParams.get("status");
    const filter: Record<string, unknown> = { org: user.id };
    if (status) filter.status = status;
    const list = await Contract.find(filter).sort({ createdAt: -1 }).limit(300);
    return NextResponse.json(list.map(toContractDTO));
}

// POST /api/contracts — черновик договора; сам файл договора прикладывается отдельно как обычный документ (DocItem)
// и привязывается через PATCH { file }. Номер вида CT-2026-1.
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    const customerName = typeof b?.customerName === "string" ? b.customerName.trim().slice(0, 200) : "";
    if (!customerName) return badRequest("customerName is required");
    await connectDB();
    const [number, author] = await Promise.all([nextNumber(user.id, "CT"), User.findById(user.userId).select("firstname lastname")]);
    const contract = await Contract.create({
        org: user.id, number, customerName,
        contact: b.contact || undefined, company: b.company || undefined, deal: b.deal || undefined,
        value: Math.max(0, Number(b.value) || 0),
        currency: typeof b.currency === "string" && b.currency.trim() ? b.currency.trim().slice(0, 6).toUpperCase() : "EUR",
        startDate: typeof b.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.startDate) ? b.startDate : "",
        endDate: typeof b.endDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.endDate) ? b.endDate : "",
        notes: typeof b.notes === "string" ? b.notes.trim().slice(0, 2000) : "",
        createdByName: author ? `${author.firstname} ${author.lastname}`.trim() : "",
    });
    return NextResponse.json(toContractDTO(contract), { status: 201 });
}
