import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { isPaidPlan } from "@/lib/billing";
import { prisma } from "@/lib/prisma";

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
    const open = await prisma.invoiceRequest.findFirst({ where: { org: user.id, status: "new" }, select: { id: true } });
    if (open) return NextResponse.json({ message: "You already have an open invoice request" }, { status: 409 });
    const [me, org] = await Promise.all([
        prisma.user.findUnique({ where: { id: user.userId }, select: { email: true } }),
        prisma.organization.findUnique({ where: { id: user.id }, select: { name: true } }),
    ]);
    await prisma.invoiceRequest.create({ data: { org: user.id, requestedBy: user.userId, email: me?.email ?? "", plan: b.plan, interval: b.interval, company: company || org?.name || "", vatId: clean(b.vatId, 40), note: clean(b.note, 500) } });
    return NextResponse.json({ ok: true }, { status: 201 });
}
