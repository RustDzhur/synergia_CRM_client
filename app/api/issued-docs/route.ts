import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { computeTotals } from "@/lib/finance/totals";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/issued-docs?kind=act|delivery_note&q= — реестр выписанных документов (ТЗ §4: вкладки
// «Акти» и «Накладні» в украинском режиме). Акт и видаткова накладна живут в заказе (номер
// присваивается при первой выписке и не меняется), поэтому реестр — это выборка заказов с номерами:
// отсюда документ открывают повторно и печатают, не разыскивая заказ.
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const url = new URL(req.url);
    const kind = url.searchParams.get("kind");
    if (kind !== "act" && kind !== "delivery_note") return badRequest("kind must be act or delivery_note");
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, 60);
    const field = kind === "act" ? "actNumber" : "deliveryNoteNumber";
    const dateField = kind === "act" ? "actDate" : "deliveryDate";
    const like = { contains: q, mode: "insensitive" as const };
    const filter: Record<string, unknown> = { org: user.id, [field]: { not: "" } };
    if (q) filter.OR = [{ [field]: like }, { number: like }, { customerName: like }];
    const list = await prisma.order.findMany({ where: filter as any, orderBy: [{ [dateField]: "desc" }, { updatedAt: "desc" }], take: 300 });
    return NextResponse.json(
        list.map((o) => {
            const totals = computeTotals((o.items ?? []) as never);
            return {
                id: o.id,
                docNumber: String((o as unknown as Record<string, string>)[field] ?? ""),
                date: String((o as unknown as Record<string, string>)[dateField] ?? ""),
                orderNumber: o.number,
                customerName: o.customerName,
                total: totals.gross,
                currency: o.currency,
            };
        })
    );
}
