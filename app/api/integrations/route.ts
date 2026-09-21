import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { appOrigin } from "@/lib/appUrl";
import { badRequest, failure, unauthorized } from "@/lib/api";
import { toIntegrationDTO } from "@/lib/integrations";
import { connectIntegration } from "@/lib/channels/connect";
import Integration from "@/models/Integration";

export const dynamic = "force-dynamic";

// GET /api/integrations — подключённые каналы текущего пользователя (без секретов)
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized();
    await connectDB();
    const list = await Integration.find({ owner: user.id, type: { $ne: "mail" } }).sort({ createdAt: 1 });
    const origin = appOrigin(req);
    return NextResponse.json(list.map((d) => toIntegrationDTO(d, origin)));
}

// POST /api/integrations — { type: "telegram" | "viber" | "messenger" | "twilio" | "webchat", ...реквизиты }
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized();
    const body = await req.json().catch(() => null);
    if (!body || typeof body.type !== "string") return badRequest("type is required");
    try {
        await connectDB();
        const origin = appOrigin(req);
        const { doc, warning } = await connectIntegration(user.id, body.type, body, origin);
        return NextResponse.json({ integration: toIntegrationDTO(doc, origin), warning: warning ?? "" }, { status: 201 });
    } catch (e) {
        return failure(e);
    }
}
