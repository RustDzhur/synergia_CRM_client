import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { appOrigin } from "@/lib/appUrl";
import { badRequest, failure, unauthorized } from "@/lib/api";
import { IntegrationFlowError, connectWithSecrets } from "@/lib/integrations/service";

export const dynamic = "force-dynamic";

// POST /api/integrations/secrets — { type, fields: { ключ: значение } }. Защищённая форма подключения: значения идут сюда напрямую
// из окна (не через чат), шифруются при сохранении; ответ и текст ошибки провайдера не содержат введённых значений.
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    if (!b || typeof b.type !== "string" || typeof b.fields !== "object" || !b.fields) return badRequest("type and fields are required");
    try {
        return NextResponse.json({ ok: true, integration: await connectWithSecrets(user.id, b.type, b.fields as Record<string, unknown>, appOrigin(req)) }, { status: 201 });
    } catch (e) {
        if (e instanceof IntegrationFlowError) return NextResponse.json({ message: e.message }, { status: e.status });
        return failure(e);
    }
}
