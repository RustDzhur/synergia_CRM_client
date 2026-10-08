// app/api/contacts/[id]/route.ts
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { unauthorized, validId } from "@/lib/api";
import { pickStrings } from "@/lib/activities";
import { prisma } from "@/lib/prisma";
import { toDTO } from "@/lib/serialize";
import { CONTACT_FIELDS, contactFullName } from "@/lib/crmFields";
import { customerBlockers, propagateContactChange, resolveContactCompany, unlinkCustomer } from "@/lib/sync/customer";

export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return NextResponse.json({ message: "Not found" }, { status: 404 });

    const contact = await prisma.contact.findUnique({ where: { id: params.id } });
    if (!contact || contact.owner !== user.id) return NextResponse.json({ message: "Not found" }, { status: 404 });

    return NextResponse.json(toDTO(contact));
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return NextResponse.json({ message: "Not found" }, { status: 404 });

    const body = await req.json();
    const data: Record<string, string> = pickStrings(body, CONTACT_FIELDS);
    if ("firstName" in data || "lastName" in data || typeof body.name === "string") {
        const name = contactFullName(data, body.name);
        if (!name) return NextResponse.json({ message: "Name is required" }, { status: 400 });
        data.name = name;
    }

    const existing = await prisma.contact.findUnique({ where: { id: params.id } });
    if (!existing || existing.owner !== user.id) return NextResponse.json({ message: "Not found" }, { status: 404 });

    const link = await resolveContactCompany(user.id, { companyId: body.companyId, company: data.company });
    const contact = await prisma.contact.update({ where: { id: params.id }, data: { ...data, ...(link ?? {}) } as any });
    // имя и реквизиты клиента разошлись по сделкам и документам — подтягиваем (lib/sync/customer.ts)
    await propagateContactChange(user.id, existing, contact);
    return NextResponse.json(toDTO(contact));
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);

    if (!validId(params.id)) return NextResponse.json({ message: "Not found" }, { status: 404 });
    const existing = await prisma.contact.findFirst({ where: { id: params.id, owner: user.id }, select: { id: true } });
    if (!existing) return NextResponse.json({ message: "Not found" }, { status: 404 });
    // Неоплаченные счета — жёсткая преграда; открытые сделки и задачи — предупреждение (?force=1 подтверждает)
    const blockers = await customerBlockers(user.id, { contact: existing.id });
    if (blockers.unpaidInvoices > 0) return NextResponse.json({ message: "The contact has unpaid invoices", code: "unpaid_invoices", blockers }, { status: 409 });
    if ((blockers.openDeals > 0 || blockers.openTasks > 0) && new URL(req.url).searchParams.get("force") !== "1") {
        return NextResponse.json({ message: "The contact has open deals or tasks", code: "has_open_work", blockers }, { status: 409 });
    }
    await unlinkCustomer(user.id, { contact: existing.id });
    await prisma.contact.deleteMany({ where: { id: existing.id, owner: user.id } });
    return NextResponse.json({ ok: true });
}
