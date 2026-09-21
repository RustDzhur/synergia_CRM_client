import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { findByToken, secretsOf } from "@/lib/integrations";
import { recordMessage } from "@/lib/channels";
import { parseViberEvent, verifyViberSignature } from "@/lib/channels/viber";

export const dynamic = "force-dynamic";

// Вебхук Viber: тело подписано токеном бота (X-Viber-Content-Signature)
export async function POST(req: Request, { params }: { params: { token: string } }) {
    await connectDB();
    const integration = await findByToken("viber", params.token);
    if (!integration) return NextResponse.json({ message: "Not found" }, { status: 404 });

    const raw = await req.text();
    if (!verifyViberSignature(raw, req.headers.get("x-viber-content-signature"), secretsOf(integration).authToken)) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
    let body;
    try { body = JSON.parse(raw); } catch { return NextResponse.json({ message: "Bad request" }, { status: 400 }); }
    const message = parseViberEvent(body); // событие «webhook» (проверка при регистрации) и прочие просто подтверждаем
    if (message) await recordMessage(integration, message);
    return NextResponse.json({ ok: true });
}
