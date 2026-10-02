import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { bookValueAt, depreciationInRange } from "@/lib/finance/assets";
import { logAudit } from "@/lib/audit";
import { requireMarket } from "@/lib/finance/marketGuard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v: unknown, def: number) => (Number.isFinite(Number(v)) ? Number(v) : def);

// GET /api/assets/:id — карточка средства с планом амортизации по месяцам
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    await requireMarket(user.id, "DE"); // Anlagen — немецкий учёт основных средств
    const a = await prisma.asset.findFirst({ where: { id: params.id, org: user.id } });
    if (!a) return notFound();

    const url = new URL(req.url);
    const to = url.searchParams.get("to");
    return NextResponse.json({
        id: a.id, name: a.name, category: a.category ?? "", acquiredDate: a.acquiredDate,
        cost: a.cost, currency: a.currency, usefulLifeYears: a.usefulLifeYears, method: a.method,
        residualValue: a.residualValue ?? 0, disposalDate: a.disposalDate ?? "", notes: a.notes ?? "",
        bookValue: bookValueAt(a, to && DATE.test(to) ? to : new Date().toISOString().slice(0, 10)),
        periodDepreciation: to && DATE.test(to) ? depreciationInRange(a, `${a.acquiredDate}`, to) : 0,
    });
}

// PATCH /api/assets/:id — исправить данные; выбытие (disposalDate) прекращает амортизацию
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const b = await req.json().catch(() => ({}));
    await requireMarket(user.id, "DE"); // Anlagen — немецкий учёт основных средств
    const asset = await prisma.asset.findFirst({ where: { id: params.id, org: user.id } });
    if (!asset) return notFound();

    const data: Record<string, unknown> = {};
    if (b.name !== undefined) {
        const v = str(b.name);
        if (!v) return badRequest("name must not be empty");
        data.name = v;
    }
    if (b.category !== undefined) data.category = str(b.category);
    if (b.acquiredDate !== undefined) {
        if (!DATE.test(str(b.acquiredDate, 10))) return badRequest("acquiredDate must be YYYY-MM-DD");
        data.acquiredDate = str(b.acquiredDate, 10);
    }
    if (b.cost !== undefined) {
        const v = num(b.cost, 0);
        if (v <= 0) return badRequest("cost must be greater than zero");
        data.cost = v;
    }
    if (b.usefulLifeYears !== undefined) {
        const v = Math.round(num(b.usefulLifeYears, 0));
        if (v < 1 || v > 100) return badRequest("usefulLifeYears must be between 1 and 100");
        data.usefulLifeYears = v;
    }
    if (b.residualValue !== undefined) data.residualValue = Math.max(0, num(b.residualValue, 0));
    if (b.disposalDate !== undefined) data.disposalDate = DATE.test(str(b.disposalDate, 10)) ? str(b.disposalDate, 10) : "";
    if (b.notes !== undefined) data.notes = str(b.notes, 1000);
    await prisma.asset.update({ where: { id: asset.id }, data: data as any });
    return NextResponse.json({ ok: true, id: asset.id });
}

// DELETE /api/assets/:id — убрать запись (например, ошиблись при вводе).
// Амортизация за прошедшие периоды при этом исчезнет из отчётов, поэтому удаление пишем в журнал.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    await requireMarket(user.id, "DE"); // Anlagen — немецкий учёт основных средств
    const asset = await prisma.asset.findFirst({ where: { id: params.id, org: user.id } });
    if (!asset) return notFound();
    await prisma.asset.deleteMany({ where: { id: asset.id } });
    await logAudit({
        org: user.id, userName: user.orgName, action: "asset.deleted", entityType: "asset", entityId: asset.id,
        summary: `Asset ${asset.name} deleted`,
    });
    return NextResponse.json({ ok: true });
}
