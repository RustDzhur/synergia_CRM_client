import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { catalogFor } from "@/lib/integrations/service";

export const dynamic = "force-dynamic";

// GET /api/integrations/catalog?q=&locale= — паспорта интеграций для рынка фирмы (planned отдаются со статусом: кнопки «подключить» у них нет)
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const url = new URL(req.url);
    return NextResponse.json({ integrations: await catalogFor(user.id, url.searchParams.get("locale") ?? "en", url.searchParams.get("q") ?? "") });
}
