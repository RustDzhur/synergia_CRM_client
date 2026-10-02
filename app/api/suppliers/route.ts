import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Поставщики фирмы (ТЗ §12): список, создание и правка. Удаление — архивирование: заказы и счета
// прошлых периодов ссылаются на поставщика и должны читаться дальше.

const toDTO = (s: any) => ({
    id: s.id,
    name: s.name,
    code: s.code ?? "",
    contactName: s.contactName ?? "",
    phone: s.phone ?? "",
    email: s.email ?? "",
    address: s.address ?? "",
    iban: s.iban ?? "",
    paymentDays: s.paymentDays ?? 0,
    currency: s.currency ?? "",
    notes: s.notes ?? "",
    archived: !!s.archived,
});

export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const list = await prisma.supplier.findMany({ where: { org: user.id }, orderBy: [{ archived: "asc" }, { name: "asc" }] });
    return NextResponse.json(list.map(toDTO));
}

export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => ({}));
    const name = String(b?.name ?? "").trim().slice(0, 120);
    if (!name) return badRequest("name is required");
    const data = {
        name,
        code: String(b?.code ?? "").slice(0, 60),
        contactName: String(b?.contactName ?? "").slice(0, 120),
        phone: String(b?.phone ?? "").slice(0, 40),
        email: String(b?.email ?? "").slice(0, 120),
        address: String(b?.address ?? "").slice(0, 300),
        iban: String(b?.iban ?? "").slice(0, 40),
        paymentDays: Math.max(0, Math.min(365, Number(b?.paymentDays) || 0)),
        currency: String(b?.currency ?? "").toUpperCase().slice(0, 6),
        notes: String(b?.notes ?? "").slice(0, 600),
    };
    const existing = await prisma.supplier.findFirst({ where: { org: user.id, name } });
    const doc = existing ? await prisma.supplier.update({ where: { id: existing.id }, data }) : await prisma.supplier.create({ data: { org: user.id, ...data } });
    return NextResponse.json(toDTO(doc), { status: 201 });
}

export async function PATCH(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => ({}));
    const id = String(b?.id ?? "");
    if (!validId(id)) return badRequest("id is required");
    const doc = await prisma.supplier.findFirst({ where: { id, org: user.id } });
    if (!doc) return notFound();
    const data: Record<string, any> = {};
    for (const key of ["name", "code", "contactName", "phone", "email", "address", "iban", "currency", "notes"] as const) {
        if (typeof b[key] === "string") data[key] = b[key].trim().slice(0, 300);
    }
    if (b.paymentDays !== undefined) data.paymentDays = Math.max(0, Math.min(365, Number(b.paymentDays) || 0));
    if (typeof b.archived === "boolean") data.archived = b.archived;
    const updated = await prisma.supplier.update({ where: { id: doc.id }, data });
    return NextResponse.json(toDTO(updated));
}
