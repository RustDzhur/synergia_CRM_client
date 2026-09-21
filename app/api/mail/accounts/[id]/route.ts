import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, notFound, unauthorized, validId } from "@/lib/api";
import { removeAccount, toMailAccountDTO } from "@/lib/mail";
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

// PATCH /api/mail/accounts/:id — { autoLeads: boolean }: создавать ли контакты и лиды из новых входящих писем
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized();
    if (!validId(params.id)) return notFound();
    const body = await req.json().catch(() => null);
    if (!body || typeof body.autoLeads !== "boolean") return badRequest("autoLeads must be true or false");
    try {
        await connectDB();
        const doc = await Integration.findOne({ _id: params.id, owner: user.id, type: "mail" });
        if (!doc) return notFound();
        doc.set("config", { ...doc.config, autoLeads: body.autoLeads });
        doc.markModified("config");
        await doc.save();
        return NextResponse.json(toMailAccountDTO(doc));
    } catch (e) {
        return failure(e);
    }
}
