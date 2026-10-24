import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { aiConfigured } from "@/lib/ai/provider";
import { dailyLimit, takeQuota } from "@/lib/ai/run";
import { findAds } from "@/lib/ads";
import { officeFailure } from "@/lib/office/api";
import { mentionsAds, parseRobotDraft } from "@/lib/office/hireVoice";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/office/robots/parse — { text } — диктовка «кого нанять» → черновик робота для формы найма.
// Та же модель и та же суточная квота, что у чата Айрис. Навыки — только из каталога (нормализация
// в lib/office/hireVoice). ads.connected — подключён ли Google Ads: от этого зависит предупреждение в форме.
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!aiConfigured()) return NextResponse.json({ message: "AI is not set up on this site yet", code: "not_configured" }, { status: 503 });

    const b = await req.json().catch(() => null);
    const text = typeof b?.text === "string" ? b.text.trim().slice(0, 4000) : "";
    if (!text) return badRequest("Text is required");

    const limit = await dailyLimit(user.id);
    if (!(await takeQuota(user.id, limit))) return NextResponse.json({ message: "The daily AI limit of your plan is used up. It resets tomorrow.", code: "limit", remaining: 0 }, { status: 429 });

    try {
        const mentioned = mentionsAds(text);
        const connected = mentioned
            ? await findAds(user.id, "google").then((docs) => docs.some((d) => d.status === "connected" && Boolean((d.config as any)?.accountId))).catch(() => false)
            : false;
        const draft = await parseRobotDraft(text);
        return NextResponse.json({ draft, ads: { mentioned, connected } });
    } catch (e) {
        return officeFailure(e);
    }
}
