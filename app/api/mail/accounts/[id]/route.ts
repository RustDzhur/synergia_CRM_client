import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { failure, notFound, unauthorized, validId } from "@/lib/api";
import { removeAccount } from "@/lib/mail";
import Integration from "@/models/Integration";

export const dynamic = "force-dynamic";

// DELETE /api/mail/accounts/:id — отключить ящик и удалить его письма из CRM (на почтовом сервере письма остаются)
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized();
    if (!validId(params.id)) return notFound();
    try {
        await connectDB();
        const doc = await Integration.findOne({ _id: params.id, owner: user.id, type: "mail" });
        if (!doc) return notFound();
        await removeAccount(doc);
        return NextResponse.json({ ok: true });
    } catch (e) {
        return failure(e);
    }
}
