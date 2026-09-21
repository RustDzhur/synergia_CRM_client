import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { failure, unauthorized } from "@/lib/api";
import { secretsOf } from "@/lib/integrations";
import { TwilioSecrets, voiceAccessToken } from "@/lib/channels/twilio";
import Integration from "@/models/Integration";

export const dynamic = "force-dynamic";

// GET /api/twilio/token — токен Voice SDK для звонков из браузера (живёт час). 204, если Twilio не подключён.
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized();
    try {
        await connectDB();
        const integration = await Integration.findOne({ owner: user.id, type: "twilio", status: "connected" });
        if (!integration) return new Response(null, { status: 204 });
        const token = voiceAccessToken(secretsOf<TwilioSecrets>(integration), user.id);
        return NextResponse.json({ token, phone: integration.config.phone });
    } catch (e) {
        return failure(e);
    }
}
