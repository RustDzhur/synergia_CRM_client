import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { bookValueAt, depreciationInRange } from "@/lib/finance/assets";
import { logAudit } from "@/lib/audit";
import Asset from "@/models/Asset";
import { requireMarket } from "@/lib/finance/marketGuard";

export const dynamic = "force-dynamic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v: unknown, def: number) => (Number.isFinite(Number(v)) ? Number(v) : def);

// GET /api/assets/:id — карточка средства с планом амортизации по месяцам
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    await connectDB();
    await requireMarket(user.id, "DE"); // Anlagen — немецкий учёт основных средств
    const a = await Asset.findOne({ _id: params.id, org: user.id });
    if (!a) return notFound();

    const url = new URL(req.url);
    const to = url.searchParams.get("to");
    return NextResponse.json({
        id: String(a._id), name: a.name, category: a.category ?? "", acquiredDate: a.acquiredDate,
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
    await connectDB();
    await requireMarket(user.id, "DE"); // Anlagen — немецкий учёт основных средств
    const asset = await Asset.findOne({ _id: params.id, org: user.id });
    if (!asset) return notFound();

    if (b.name !== undefined) {
        const v = str(b.name);
        if (!v) return badRequest("name must not be empty");
        asset.name = v;
    }
    if (b.category !== undefined) asset.category = str(b.category);
    if (b.acquiredDate !== undefined) {
        if (!DATE.test(str(b.acquiredDate, 10))) return badRequest("acquiredDate must be YYYY-MM-DD");
        asset.acquiredDate = str(b.acquiredDate, 10);
    }
    if (b.cost !== undefined) {
        const v = num(b.cost, 0);
        if (v <= 0) return badRequest("cost must be greater than zero");
        asset.cost = v;
    }
    if (b.usefulLifeYears !== undefined) {
        const v = Math.round(num(b.usefulLifeYears, 0));
        if (v < 1 || v > 100) return badRequest("usefulLifeYears must be between 1 and 100");
        asset.usefulLifeYears = v;
    }
    if (b.residualValue !== undefined) asset.residualValue = Math.max(0, num(b.residualValue, 0));
    if (b.disposalDate !== undefined) asset.disposalDate = DATE.test(str(b.disposalDate, 10)) ? str(b.disposalDate, 10) : "";
    if (b.notes !== undefined) asset.notes = str(b.notes, 1000);
    await asset.save();
    return NextResponse.json({ ok: true, id: String(asset._id) });
}

// DELETE /api/assets/:id — убрать запись (например, ошиблись при вводе).
// Амортизация за прошедшие периоды при этом исчезнет из отчётов, поэтому удаление пишем в журнал.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    await connectDB();
    await requireMarket(user.id, "DE"); // Anlagen — немецкий учёт основных средств
    const asset = await Asset.findOneAndDelete({ _id: params.id, org: user.id });
    if (!asset) return notFound();
    await logAudit({
        org: user.id, userName: user.orgName, action: "asset.deleted", entityType: "asset", entityId: String(asset._id),
        summary: `Asset ${asset.name} deleted`,
    });
    return NextResponse.json({ ok: true });
}
