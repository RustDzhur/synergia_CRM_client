import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { appOrigin } from "@/lib/appUrl";
import { failure, notFound, unauthorized, validId } from "@/lib/api";
import { shareLink } from "@/lib/share";
import Quote from "@/models/Quote";
import User from "@/models/User";

export const dynamic = "force-dynamic";

// GET /api/quotes/:id/share — публичная ссылка на предложение: клиент открывает её без входа,
// отмечает нужные позиции и принимает предложение — сумма пересчитывается на месте, а в CRM
// остаётся принятое предложение с выбранными позициями.
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    try {
        await connectDB();
        const quote = await Quote.findOne({ _id: params.id, org: user.id }).select("_id");
        if (!quote) return notFound();
        const author = await User.findById(user.userId).select("firstname lastname");
        const link = await shareLink(user.id, "quote", params.id, author ? `${author.firstname} ${author.lastname}`.trim() : "");
        return NextResponse.json({ url: `${appOrigin(req)}/c/${link.token}`, views: link.views ?? 0 });
    } catch (e) {
        return failure(e);
    }
}
