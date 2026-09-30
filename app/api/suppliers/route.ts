import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import Supplier from "@/models/Supplier";

export const dynamic = "force-dynamic";

// Поставщики фирмы (ТЗ §12): список, создание и правка. Удаление — архивирование: заказы и счета
// прошлых периодов ссылаются на поставщика и должны читаться дальше.

const toDTO = (s: any) => ({
    id: String(s._id),
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
    await connectDB();
    const list = await Supplier.find({ org: user.id }).sort({ archived: 1, name: 1 });
    return NextResponse.json(list.map(toDTO));
}

export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => ({}));
    const name = String(b?.name ?? "").trim().slice(0, 120);
    if (!name) return badRequest("name is required");
    await connectDB();
    const doc = await Supplier.findOneAndUpdate(
        { org: user.id, name },
        {
            $set: {
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
            },
        },
        { upsert: true, new: true }
    );
    return NextResponse.json(toDTO(doc), { status: 201 });
}

export async function PATCH(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => ({}));
    const id = String(b?.id ?? "");
    if (!validId(id)) return badRequest("id is required");
    await connectDB();
    const doc = await Supplier.findOne({ _id: id, org: user.id });
    if (!doc) return notFound();
    for (const key of ["name", "code", "contactName", "phone", "email", "address", "iban", "currency", "notes"] as const) {
        if (typeof b[key] === "string") doc.set(key, b[key].trim().slice(0, 300));
    }
    if (b.paymentDays !== undefined) doc.paymentDays = Math.max(0, Math.min(365, Number(b.paymentDays) || 0));
    if (typeof b.archived === "boolean") doc.archived = b.archived;
    await doc.save();
    return NextResponse.json(toDTO(doc));
}
