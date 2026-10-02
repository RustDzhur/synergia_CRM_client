import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { appOrigin } from "@/lib/appUrl";
import { badRequest, failure, notFound, unauthorized, validId } from "@/lib/api";
import { toIntegrationDTO } from "@/lib/integrations";
import { checkIntegration, reRegisterWebhook, removeIntegration, webchatConfig } from "@/lib/channels/connect";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// PATCH /api/integrations/:id — { action: "webhook" } перерегистрирует вебхук; для онлайн-чата — новые настройки оформления
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const body = await req.json().catch(() => null);
    if (!body) return badRequest("Invalid body");
    try {
        const doc = await prisma.integration.findFirst({ where: { id: params.id, owner: user.id } });
        if (!doc) return notFound();
        const origin = appOrigin(req);
        if (body.action === "webhook") {
            await reRegisterWebhook(doc, origin);
        } else if (body.action === "check") {
            await checkIntegration(doc, origin);
        } else if (doc.type === "webchat") {
            await prisma.integration.update({ where: { id: doc.id }, data: { config: webchatConfig(body) } });
        } else {
            return badRequest("Nothing to update");
        }
        // действия выше меняют статус/ошибку — отдаём запись как она есть сейчас
        const fresh = await prisma.integration.findUnique({ where: { id: doc.id } });
        return NextResponse.json(toIntegrationDTO(fresh ?? doc, origin));
    } catch (e) {
        return failure(e);
    }
}

// DELETE /api/integrations/:id — отключить канал (вместе с его беседами)
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    try {
        const doc = await prisma.integration.findFirst({ where: { id: params.id, owner: user.id } });
        if (!doc) return notFound();
        await removeIntegration(doc);
        return NextResponse.json({ ok: true });
    } catch (e) {
        return failure(e);
    }
}
