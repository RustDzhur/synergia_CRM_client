import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, unauthorized } from "@/lib/api";
import { assetsSummary, bookValueAt } from "@/lib/finance/assets";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireMarket } from "@/lib/finance/marketGuard";

export const dynamic = "force-dynamic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v: unknown, def: number) => (Number.isFinite(Number(v)) ? Number(v) : def);

// Основное средство наружу: к сохранённым полям добавляем расчётные — сколько уже списано
// и сколько осталось, чтобы интерфейс не повторял арифметику.
const toDTO = (a: any) => ({
    id: a.id,
    name: a.name,
    category: a.category ?? "",
    acquiredDate: a.acquiredDate,
    cost: a.cost ?? 0,
    currency: a.currency ?? "EUR",
    usefulLifeYears: a.usefulLifeYears,
    method: a.method ?? "linear",
    residualValue: a.residualValue ?? 0,
    disposalDate: a.disposalDate ?? "",
    notes: a.notes ?? "",
    bookValue: bookValueAt(a, a.disposalDate || new Date().toISOString().slice(0, 10)),
    createdAt: a.createdAt?.toISOString?.() ?? "",
});

// GET /api/assets?from=&to= — список основных средств; с периодом добавляет амортизацию за него
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    // отказ по режиму рынка — 409 с кодом market, а не 500 от исключения
    try { await requireMarket(user.id, "DE"); } catch (e) { return failure(e); } // Anlagen — немецкий учёт основных средств
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const list = await prisma.asset.findMany({ where: { org: user.id }, orderBy: { acquiredDate: "desc" }, take: 500 });

    if (from && to && DATE.test(from) && DATE.test(to)) {
        const summary = assetsSummary(list as never, from, to);
        const byName = new Map(summary.rows.map((r) => [r.name, r]));
        return NextResponse.json({ assets: list.map((a) => ({ ...toDTO(a), periodDepreciation: byName.get(a.name)?.periodAmount ?? 0 })), summary });
    }
    return NextResponse.json({ assets: list.map(toDTO), summary: null });
}

// POST /api/assets — поставить основное средство на учёт
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    const name = str(b?.name);
    const acquiredDate = str(b?.acquiredDate, 10);
    if (!name) return badRequest("name is required");
    if (!DATE.test(acquiredDate)) return badRequest("acquiredDate must be YYYY-MM-DD");
    const cost = num(b?.cost, 0);
    if (cost <= 0) return badRequest("cost must be greater than zero");
    const years = Math.round(num(b?.usefulLifeYears, 0));
    if (years < 1 || years > 100) return badRequest("usefulLifeYears must be between 1 and 100");

// отказ по режиму рынка — 409 с кодом market, а не 500 от исключения

try {  } catch (e) { return failure(e); }
    await requireMarket(user.id, "DE"); // Anlagen — немецкий учёт основных средств
    const author = await prisma.user.findUnique({ where: { id: user.userId }, select: { firstname: true, lastname: true } });
    const asset = await prisma.asset.create({
        data: {
            org: user.id, name, category: str(b?.category), acquiredDate, cost,
            currency: str(b?.currency, 6).toUpperCase() || "EUR",
            usefulLifeYears: years,
            residualValue: Math.max(0, num(b?.residualValue, 0)),
            disposalDate: DATE.test(str(b?.disposalDate, 10)) ? str(b?.disposalDate, 10) : "",
            notes: str(b?.notes, 1000),
            createdByName: author ? `${author.firstname} ${author.lastname}`.trim() : "",
        },
    });
    await logAudit({
        org: user.id, userName: asset.createdByName || "—", action: "asset.created", entityType: "asset", entityId: asset.id,
        summary: `Asset ${name} registered (${cost} ${asset.currency}, ${years} years)`,
    });
    return NextResponse.json(toDTO(asset), { status: 201 });
}
