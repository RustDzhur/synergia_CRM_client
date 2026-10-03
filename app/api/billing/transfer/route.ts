import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, unauthorized } from "@/lib/api";
import { OrderError, createOrder, getRequisites, listOrders, orderView } from "@/lib/transferPay";

export const dynamic = "force-dynamic";

// GET /api/billing/transfer — мои неоплаченные и заявленные счета на тариф
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    return NextResponse.json((await listOrders(user.id, ["new", "claimed"])).map(({ id, number, plan, interval, method, amount, usdtAmount, currency, status }) => ({ id, number, plan, interval, method, amount, usdtAmount, currency, status })));
}

// POST /api/billing/transfer — { plan, interval, method: "bank" | "usdt", company, vatId?, locale? }: оформить счёт → { order, view }
// Рынок (Германия — евро по немецким реквизитам, Украина — гривна по украинским) определяется по стране фирмы.
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    if (!b) return badRequest("Invalid request");
    try {
        const order = await createOrder(user.id, { ...b, locale: typeof b.locale === "string" ? b.locale : undefined });
        return NextResponse.json(orderView(order, await getRequisites()), { status: 201 });
    } catch (e) {
        if (e instanceof OrderError) return NextResponse.json({ message: e.message }, { status: e.status });
        return failure(e);
    }
}
