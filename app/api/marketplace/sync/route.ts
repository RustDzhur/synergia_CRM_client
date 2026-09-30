import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { findIntegrationByType } from "@/lib/integrations";
import { checkMarketplace, syncMarketplaces } from "@/lib/marketplace";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/marketplace/sync — { provider?, check? }: забрать заказы площадок в воронку.
// Без provider — все подключённые; с provider и check — просто проверить подключение и показать,
// что площадка ответила (по этому видно, верный ли токен и те ли поля приходят).
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const body = await req.json().catch(() => ({}));
    const provider = typeof body?.provider === "string" ? body.provider : "";
    try {
        await connectDB();
        if (provider && body?.check) {
            const doc = await findIntegrationByType(user.id, provider);
            if (!doc) return NextResponse.json({ message: "Площадка не подключена" }, { status: 404 });
            const result = await checkMarketplace(doc);
            return NextResponse.json(result, { status: result.ok ? 200 : 502 });
        }
        const results = await syncMarketplaces(user.id, 30).then((list) => (provider ? list.filter((r) => r.provider === provider) : list));
        return NextResponse.json({ results });
    } catch (e) {
        return NextResponse.json({ message: e instanceof Error ? e.message : "Синхронизация не удалась" }, { status: 502 });
    }
}
