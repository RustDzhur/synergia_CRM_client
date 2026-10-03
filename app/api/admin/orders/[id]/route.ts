import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { failure, notFound, validId } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { OrderError, cancelOrder, confirmOrder } from "@/lib/transferPay";

export const dynamic = "force-dynamic";

// POST /api/admin/orders/:id — { action: "confirm" | "cancel" }: деньги поступили → включить тариф; либо отменить счёт.
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const admin = await requirePlatformAdmin(req);
    if (!admin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    if (!validId(params.id)) return notFound();
    const b = await req.json().catch(() => ({}));
    try {
        const order = b?.action === "cancel" ? await cancelOrder(params.id) : await confirmOrder(params.id);
        await logAudit({ org: order.org, userId: admin.id, action: order.status === "paid" ? "billing.order_confirmed" : "billing.order_cancelled", entityType: "billing_order", entityId: order.id, summary: `Order ${order.number} (${order.plan}/${order.interval}) ${order.status}`, meta: { amount: order.amount, currency: order.currency, method: order.method } });
        return NextResponse.json(order);
    } catch (e) {
        if (e instanceof OrderError) return NextResponse.json({ message: e.message }, { status: e.status });
        return failure(e);
    }
}
