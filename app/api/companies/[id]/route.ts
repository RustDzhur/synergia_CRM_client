import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { unauthorized, validId } from "@/lib/api";
import { pickStrings } from "@/lib/activities";
import { prisma } from "@/lib/prisma";
import { toDTO } from "@/lib/serialize";
import { COMPANY_FIELDS } from "@/lib/crmFields";
import { customerBlockers, propagateCompanyChange, unlinkCustomer } from "@/lib/sync/customer";

export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return NextResponse.json({ message: "Not found" }, { status: 404 });

    const company = await prisma.company.findUnique({ where: { id: params.id } });
    if (!company || company.owner !== user.id) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json(toDTO(company));
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return NextResponse.json({ message: "Not found" }, { status: 404 });

    const data = pickStrings(await req.json(), COMPANY_FIELDS);
    if ("name" in data && !data.name) return NextResponse.json({ message: "Name is required" }, { status: 400 });

    const existing = await prisma.company.findUnique({ where: { id: params.id } });
    if (!existing || existing.owner !== user.id) return NextResponse.json({ message: "Not found" }, { status: 404 });
    const company = await prisma.company.update({ where: { id: params.id }, data: data as any });
    await propagateCompanyChange(user.id, existing, company);
    return NextResponse.json(toDTO(company));
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);

    if (!validId(params.id)) return NextResponse.json({ message: "Not found" }, { status: 404 });
    const existing = await prisma.company.findFirst({ where: { id: params.id, owner: user.id }, select: { id: true } });
    if (!existing) return NextResponse.json({ message: "Not found" }, { status: 404 });
    const blockers = await customerBlockers(user.id, { company: existing.id });
    if (blockers.unpaidInvoices > 0) return NextResponse.json({ message: "The company has unpaid invoices", code: "unpaid_invoices", blockers }, { status: 409 });
    if ((blockers.openDeals > 0 || blockers.openTasks > 0) && new URL(req.url).searchParams.get("force") !== "1") {
        return NextResponse.json({ message: "The company has open deals or tasks", code: "has_open_work", blockers }, { status: 409 });
    }
    await unlinkCustomer(user.id, { company: existing.id });
    await prisma.company.deleteMany({ where: { id: existing.id, owner: user.id } });
    return NextResponse.json({ ok: true });
}
