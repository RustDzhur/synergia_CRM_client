import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, notFound, unauthorized, validId } from "@/lib/api";
import { cancelProductionOrder, launchProductionOrder, produceOutput } from "@/lib/finance/productionOrders";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Производственный заказ: запуск (резерв материалов), выпуск (списание + приход на склад), отмена.
//   { action: "launch" }                                   — зарезервировать материалы;
//   { action: "output", qty, scrapQty?, actualMinutes? }    — выпустить часть или всё;
//   { action: "cancel" }                                    — снять резерв и закрыть заказ.
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const b = await req.json().catch(() => ({}));
    try {
        const author = await prisma.user.findUnique({ where: { id: user.userId }, select: { firstname: true, lastname: true } });
        const by = author ? `${author.firstname} ${author.lastname}`.trim() : "";

        if (b?.action === "launch") {
            const order = await launchProductionOrder(user.id, params.id);
            await logAudit({ org: user.id, userId: user.userId, action: "production.launch", entityType: "production", entityId: params.id, summary: `Production order ${order.number} launched`, meta: {} });
            return NextResponse.json({ ok: true, status: order.status });
        }
        if (b?.action === "output") {
            const result = await produceOutput(user.id, params.id, { qty: Number(b?.qty) || 0, scrapQty: Number(b?.scrapQty) || 0, actualMinutes: Number(b?.actualMinutes) || 0, by });
            await logAudit({ org: user.id, userId: user.userId, action: "production.output", entityType: "production", entityId: params.id, summary: `Production ${result.order.number}: output ${result.portion}, unit cost ${result.unitCost}`, meta: { unitCost: result.unitCost } });
            return NextResponse.json({ ok: true, status: result.order.status, portion: result.portion, unitCost: result.unitCost, cost: result.cost });
        }
        if (b?.action === "cancel") {
            const order = await cancelProductionOrder(user.id, params.id);
            return NextResponse.json({ ok: true, status: order.status });
        }
        return badRequest('action must be "launch", "output" or "cancel"');
    } catch (e) {
        return failure(e);
    }
}
