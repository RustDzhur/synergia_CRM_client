import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Склады фирмы (ТЗ §12): список, создание и правка. Удаление — архивирование: склад исчезает из
// выбора, но движения и документы по нему остаются в истории (склад нельзя «удалить» из прошлого).

const toDTO = (w: any) => ({
    id: w.id,
    name: w.name,
    kind: w.kind ?? "warehouse",
    address: w.address ?? "",
    isDefault: !!w.isDefault,
    archived: !!w.archived,
});

export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const list = await prisma.warehouse.findMany({ where: { org: user.id }, orderBy: [{ archived: "asc" }, { name: "asc" }] });
    return NextResponse.json(list.map(toDTO));
}

export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => ({}));
    const name = String(b?.name ?? "").trim().slice(0, 80);
    if (!name) return badRequest("name is required");
    const kind = ["warehouse", "store", "transit"].includes(String(b?.kind)) ? String(b.kind) : "warehouse";
    const isDefault = !!b?.isDefault;
    if (isDefault) await prisma.warehouse.updateMany({ where: { org: user.id }, data: { isDefault: false } });
    const data = { name, kind, address: String(b?.address ?? "").slice(0, 200), isDefault, archived: !!b?.archived };
    const existing = await prisma.warehouse.findFirst({ where: { org: user.id, name } });
    const doc = existing ? await prisma.warehouse.update({ where: { id: existing.id }, data }) : await prisma.warehouse.create({ data: { org: user.id, ...data } });
    return NextResponse.json(toDTO(doc), { status: 201 });
}

export async function PATCH(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => ({}));
    const id = String(b?.id ?? "");
    if (!validId(id)) return badRequest("id is required");
    const doc = await prisma.warehouse.findFirst({ where: { id, org: user.id } });
    if (!doc) return notFound();
    const data: Record<string, any> = {};
    if (typeof b.name === "string" && b.name.trim()) data.name = b.name.trim().slice(0, 80);
    if (["warehouse", "store", "transit"].includes(String(b.kind))) data.kind = b.kind;
    if (typeof b.address === "string") data.address = b.address.trim().slice(0, 200);
    if (typeof b.archived === "boolean") data.archived = b.archived;
    if (b.isDefault === true) {
        await prisma.warehouse.updateMany({ where: { org: user.id }, data: { isDefault: false } });
        data.isDefault = true;
    }
    const updated = await prisma.warehouse.update({ where: { id: doc.id }, data });
    return NextResponse.json(toDTO(updated));
}
