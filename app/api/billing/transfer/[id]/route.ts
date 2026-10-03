import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { failure, notFound, unauthorized, validId } from "@/lib/api";
import { OrderError, claimOrder, findOrder, getRequisites, notifyClaim, orderView } from "@/lib/transferPay";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/billing/transfer/:id — счёт с реквизитами и QR
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const order = await findOrder(params.id, user.id);
    return order ? NextResponse.json(orderView(order, await getRequisites())) : notFound();
}

// POST /api/billing/transfer/:id — { payerRef? }: «я оплатил» → счёт попадает в очередь администратора на подтверждение
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const b = await req.json().catch(() => ({}));
    try {
        const order = await claimOrder(params.id, user.id, typeof b?.payerRef === "string" ? b.payerRef : "");
        const org = await prisma.organization.findUnique({ where: { id: user.id }, select: { name: true } });
        void notifyClaim(order, org?.name ?? user.id);
        return NextResponse.json(orderView(order, await getRequisites()));
    } catch (e) {
        if (e instanceof OrderError) return NextResponse.json({ message: e.message }, { status: e.status });
        return failure(e);
    }
}
