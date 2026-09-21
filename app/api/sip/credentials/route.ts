import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { secretsOf } from "@/lib/integrations";
import Integration from "@/models/Integration";

export const dynamic = "force-dynamic";

// GET /api/sip/credentials — реквизиты SIP для браузера. Регистрация у провайдера идёт прямо из браузера,
// поэтому ему нужен пароль; он отдаётся только вошедшему владельцу и не кэшируется. 404 — SIP не подключён.
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized();
    await connectDB();
    const doc = await Integration.findOne({ owner: user.id, type: "sip", status: "connected" });
    if (!doc) return NextResponse.json({ message: "Not connected" }, { status: 404 });
    const { password } = secretsOf<{ password: string }>(doc);
    return NextResponse.json(
        { integrationId: doc._id.toString(), ...doc.config, password },
        { headers: { "Cache-Control": "no-store" } }
    );
}
