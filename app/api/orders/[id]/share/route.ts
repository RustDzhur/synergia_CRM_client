import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { appOrigin } from "@/lib/appUrl";
import { failure, notFound, unauthorized, validId } from "@/lib/api";
import { shareLink } from "@/lib/share";
import Order from "@/models/Order";
import User from "@/models/User";

export const dynamic = "force-dynamic";

// GET /api/orders/:id/share — публичная ссылка на статус заказа для клиента.
// Ссылку можно отправить в мессенджер: клиент откроет её без входа и увидит статус, состав,
// доставку и кнопку оплаты, если счёт ещё не оплачен.
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    try {
        await connectDB();
        const order = await Order.findOne({ _id: params.id, org: user.id }).select("_id");
        if (!order) return notFound();
        const author = await User.findById(user.userId).select("firstname lastname");
        const link = await shareLink(user.id, "order", params.id, author ? `${author.firstname} ${author.lastname}`.trim() : "");
        return NextResponse.json({ url: `${appOrigin(req)}/c/${link.token}`, views: link.views ?? 0 });
    } catch (e) {
        return failure(e);
    }
}
