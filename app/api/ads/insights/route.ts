import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { adsPlanOk, findAds, insightsFor, toConnectionDTO } from "@/lib/ads";
import type { AdsInsights } from "@/lib/ads/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/ads/insights?days=30 — расход, клики, показы и конверсии по каждому подключённому рекламному аккаунту
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const days = Math.min(90, Math.max(1, Number(new URL(req.url).searchParams.get("days")) || 30));
    await connectDB();
    // фирма понизила тариф уже после подключения рекламы — данные больше не отдаём, но подключение остаётся (можно вернуть тариф)
    if (!(await adsPlanOk(user.id))) return NextResponse.json({ days, items: [], planOk: false });
    const docs = (await findAds(user.id)).filter((d) => d.config.accountId);
    const items = await Promise.all(
        docs.map(async (d) => {
            let data: AdsInsights | null = null;
            let error = "";
            try {
                data = await insightsFor(d, days);
            } catch (e) {
                error = (e as Error).message || "Could not load ad data";
            }
            return { connection: toConnectionDTO(d), data, error };
        })
    );
    return NextResponse.json({ days, items });
}
