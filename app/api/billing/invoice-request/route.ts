import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { isPaidPlan } from "@/lib/billing";
import InvoiceRequest from "@/models/InvoiceRequest";
import Organization from "@/models/Organization";
import User from "@/models/User";

export const dynamic = "force-dynamic";

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\p{Cc}<>]/gu, "").trim().slice(0, max) : "");

// POST /api/billing/invoice-request — { plan, interval, company, vatId?, note? }: заявка на оплату банковским переводом по счёту
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    if (!b || !isPaidPlan(b.plan) || (b.interval !== "month" && b.interval !== "year")) return badRequest("Invalid plan");
    const company = clean(b.company, 200);
    if (!company) return badRequest("Company name and address are required");
    await connectDB();
    if (await InvoiceRequest.exists({ org: user.id, status: "new" })) return NextResponse.json({ message: "You already have an open invoice request" }, { status: 409 });
    const me = await User.findById(user.userId).select("email");
    const org = await Organization.findById(user.id).select("name");
    await InvoiceRequest.create({ org: user.id, requestedBy: user.userId, email: me?.email ?? "", plan: b.plan, interval: b.interval, company: company || org?.name || "", vatId: clean(b.vatId, 40), note: clean(b.note, 500) });
    return NextResponse.json({ ok: true }, { status: 201 });
}
