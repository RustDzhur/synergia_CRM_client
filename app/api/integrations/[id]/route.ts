import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { appOrigin } from "@/lib/appUrl";
import { badRequest, failure, notFound, unauthorized, validId } from "@/lib/api";
import { toIntegrationDTO } from "@/lib/integrations";
import { reRegisterWebhook, removeIntegration, webchatConfig } from "@/lib/channels/connect";
import Integration from "@/models/Integration";

export const dynamic = "force-dynamic";

// PATCH /api/integrations/:id — { action: "webhook" } перерегистрирует вебхук; для онлайн-чата — новые настройки оформления
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized();
    if (!validId(params.id)) return notFound();
    const body = await req.json().catch(() => null);
    if (!body) return badRequest("Invalid body");
    try {
        await connectDB();
        const doc = await Integration.findOne({ _id: params.id, owner: user.id });
        if (!doc) return notFound();
        const origin = appOrigin(req);
        if (body.action === "webhook") {
            await reRegisterWebhook(doc, origin);
        } else if (doc.type === "webchat") {
            doc.config = webchatConfig(body);
            await doc.save();
        } else {
            return badRequest("Nothing to update");
        }
        return NextResponse.json(toIntegrationDTO(doc, origin));
    } catch (e) {
        return failure(e);
    }
}

// DELETE /api/integrations/:id — отключить канал (вместе с его беседами)
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized();
    if (!validId(params.id)) return notFound();
    try {
        await connectDB();
        const doc = await Integration.findOne({ _id: params.id, owner: user.id });
        if (!doc) return notFound();
        await removeIntegration(doc);
        return NextResponse.json({ ok: true });
    } catch (e) {
        return failure(e);
    }
}
