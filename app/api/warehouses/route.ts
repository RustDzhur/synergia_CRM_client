import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import Warehouse from "@/models/Warehouse";

export const dynamic = "force-dynamic";

// Склады фирмы (ТЗ §12): список, создание и правка. Удаление — архивирование: склад исчезает из
// выбора, но движения и документы по нему остаются в истории (склад нельзя «удалить» из прошлого).

const toDTO = (w: any) => ({
    id: String(w._id),
    name: w.name,
    kind: w.kind ?? "warehouse",
    address: w.address ?? "",
    isDefault: !!w.isDefault,
    archived: !!w.archived,
});

export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    await connectDB();
    const list = await Warehouse.find({ org: user.id }).sort({ archived: 1, name: 1 });
    return NextResponse.json(list.map(toDTO));
}

export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => ({}));
    const name = String(b?.name ?? "").trim().slice(0, 80);
    if (!name) return badRequest("name is required");
    await connectDB();
    const kind = ["warehouse", "store", "transit"].includes(String(b?.kind)) ? String(b.kind) : "warehouse";
    const isDefault = !!b?.isDefault;
    if (isDefault) await Warehouse.updateMany({ org: user.id }, { $set: { isDefault: false } });
    const doc = await Warehouse.findOneAndUpdate(
        { org: user.id, name },
        { $set: { name, kind, address: String(b?.address ?? "").slice(0, 200), isDefault, archived: !!b?.archived } },
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
    const doc = await Warehouse.findOne({ _id: id, org: user.id });
    if (!doc) return notFound();
    if (typeof b.name === "string" && b.name.trim()) doc.name = b.name.trim().slice(0, 80);
    if (["warehouse", "store", "transit"].includes(String(b.kind))) doc.kind = b.kind;
    if (typeof b.address === "string") doc.address = b.address.trim().slice(0, 200);
    if (typeof b.archived === "boolean") doc.archived = b.archived;
    if (b.isDefault === true) {
        await Warehouse.updateMany({ org: user.id }, { $set: { isDefault: false } });
        doc.isDefault = true;
    }
    await doc.save();
    return NextResponse.json(toDTO(doc));
}
