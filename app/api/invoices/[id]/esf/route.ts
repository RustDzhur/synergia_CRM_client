import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, notFound, unauthorized, validId } from "@/lib/api";
import { requireMarket } from "@/lib/finance/marketGuard";
import { cleanEsfMark, esfIssues, type EsfInvoice } from "@/lib/finance/esf";
import { financeSettings } from "@/lib/finance/settings";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import type { UzProfile } from "@/lib/validation/uz";

export const dynamic = "force-dynamic";

async function load(org: string, id: string) {
    if (!validId(id)) return null;
    const inv = await prisma.invoice.findUnique({ where: { id } });
    return inv && inv.org === org ? inv : null;
}

// GET /api/invoices/:id/esf — проверка полноты данных для ЭСФ и отметка о выписке (рынок UZ)
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    try { await requireMarket(user.id, "UZ"); } catch (e) { return failure(e); }
    const inv = await load(user.id, params.id);
    if (!inv) return notFound();
    const settings = await financeSettings(user.id);
    const issues = esfIssues(inv as unknown as EsfInvoice, { legalName: settings.legalName, address: settings.address }, ((settings as { uz?: unknown }).uz ?? {}) as Partial<UzProfile>);
    return NextResponse.json({ issues, mark: cleanEsfMark(inv.esf) ?? { status: "none" } });
}

// PATCH /api/invoices/:id/esf — { status, number?, at?, operator? }: человек отмечает, что ЭСФ выписан у оператора.
// Отметка ничего не отправляет и не меняет сам счёт; нельзя отметить ЭСФ для черновика и отменённого счёта.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    try { await requireMarket(user.id, "UZ"); } catch (e) { return failure(e); }
    const inv = await load(user.id, params.id);
    if (!inv) return notFound();
    if (inv.status === "draft" || inv.status === "cancelled") return badRequest("ESF can be marked only for an issued invoice");
    const b = await req.json().catch(() => null);
    const mark = cleanEsfMark(b);
    if (!mark) return badRequest("Invalid body");
    if ((mark.status === "sent" || mark.status === "confirmed") && !mark.number) return badRequest("ESF number is required for this status");
    await prisma.invoice.update({ where: { id: inv.id }, data: { esf: mark as never } });
    await logAudit({ org: user.id, userId: user.userId, action: "invoice.esf", entityType: "invoice", entityId: inv.id, summary: `ESF ${mark.status} ${mark.number ?? ""} — ${inv.number}`.trim(), meta: { mark } });
    return NextResponse.json({ mark });
}
