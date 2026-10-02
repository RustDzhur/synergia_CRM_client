import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { appOrigin } from "@/lib/appUrl";
import { badRequest, failure, unauthorized } from "@/lib/api";
import { toIntegrationDTO } from "@/lib/integrations";
import { whatsappVerifyToken } from "@/lib/platformSettings";
import { connectIntegration, connectMetaChoice, healWebhooks } from "@/lib/channels/connect";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/integrations — подключённые каналы текущего пользователя (без секретов)
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    await healWebhooks(user.id, appOrigin(req)).catch(() => undefined);
    const list = await prisma.integration.findMany({
        where: { owner: user.id, type: { notIn: ["mail", "gdrive", "gcal", "ads", "icloud"] } },
        orderBy: { createdAt: "asc" },
    });
    const origin = appOrigin(req);
    // WhatsApp настраивается в Meta вручную: отдаём общий маркер подтверждения, чтобы его было
    // откуда скопировать в кабинет Meta
    const whatsapp = list.some((d) => d.type === "whatsapp");
    const verifyToken = whatsapp ? await whatsappVerifyToken() : "";
    return NextResponse.json(list.map((d) => ({ ...toIntegrationDTO(d, origin), ...(d.type === "whatsapp" ? { platformVerifyToken: verifyToken } : {}) })));
}

// POST /api/integrations — { type: "telegram" | "viber" | "messenger" | "twilio" | "webchat", ...реквизиты }
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const body = await req.json().catch(() => null);
    if (!body || typeof body.type !== "string") return badRequest("type is required");
    try {
        const origin = appOrigin(req);
        // Выбор страницы (или номера) после входа через Facebook: токен уже получен на шаге возврата
        // и лежит в секретах, поэтому здесь достаточно указать, что подключаем.
        const chosen = body.type === "messenger" ? String(body.pageId ?? "") : body.type === "whatsapp" ? String(body.numberId ?? "") : "";
        if (chosen) {
            const result = await connectMetaChoice(user.id, body.type as "messenger" | "whatsapp", chosen, origin);
            const doc = await prisma.integration.findFirst({ where: { owner: user.id, type: body.type } });
            if (!doc) return badRequest("Start the connection again");
            return NextResponse.json({ integration: toIntegrationDTO(doc, origin), warning: result.warning ?? "" }, { status: 201 });
        }
        const { doc, warning } = await connectIntegration(user.id, body.type, body, origin);
        return NextResponse.json({ integration: toIntegrationDTO(doc, origin), warning: warning ?? "" }, { status: 201 });
    } catch (e) {
        return failure(e);
    }
}
