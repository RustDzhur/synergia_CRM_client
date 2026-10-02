import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, notFound, unauthorized, validId } from "@/lib/api";
import { removeAccount, toMailAccountDTO } from "@/lib/mail";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// DELETE /api/mail/accounts/:id — отключить ящик и удалить его письма из CRM (на почтовом сервере письма остаются)
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    try {
        const doc = await prisma.integration.findFirst({ where: { id: params.id, owner: user.id, type: "mail" } });
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
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const body = await req.json().catch(() => null);
    if (!body || typeof body.autoLeads !== "boolean") return badRequest("autoLeads must be true or false");
    try {
        const doc = await prisma.integration.findFirst({ where: { id: params.id, owner: user.id, type: "mail" } });
        if (!doc) return notFound();
        const updated = await prisma.integration.update({ where: { id: doc.id }, data: { config: { ...((doc.config ?? {}) as any), autoLeads: body.autoLeads } as any } });
        return NextResponse.json(toMailAccountDTO(updated));
    } catch (e) {
        return failure(e);
    }
}
