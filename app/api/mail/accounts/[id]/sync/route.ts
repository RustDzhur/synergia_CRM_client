import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { failure, notFound, unauthorized, validId } from "@/lib/api";
import { syncAccount, toMailAccountDTO } from "@/lib/mail";
import Integration from "@/models/Integration";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/mail/accounts/:id/sync — забрать новые письма с почтового сервера
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized();
    if (!validId(params.id)) return notFound();
    try {
        await connectDB();
        const doc = await Integration.findOne({ _id: params.id, owner: user.id, type: "mail" });
        if (!doc) return notFound();
        const added = await syncAccount(doc);
        return NextResponse.json({ added, account: toMailAccountDTO(doc) });
    } catch (e) {
        return failure(e);
    }
}
