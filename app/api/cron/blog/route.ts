import { NextResponse } from "next/server";
import { aiConfigured } from "@/lib/ai/provider";
import { writeBlogArticle } from "@/lib/blogWriter";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// GET /api/cron/blog — ежедневный блог-робот внутри CRM: cron сервера каждые 10 минут
// («*/10 * * * *» + deploy/cron-blog.js), внутри — защита от дублей (не больше 2 статей в сутки,
// вторая не раньше чем через 8 часов — lib/blogWriter.ts). Публикует сразу (published: true),
// картинка — Openverse CC0/PD → public/images/blog/<slug>.jpg; на сайт статьи уезжают sync-blog.sh.
export async function GET(req: Request) {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
    if (!aiConfigured()) return NextResponse.json({ message: "AI is not configured on this site", code: "not_configured" }, { status: 503 });
    try {
        const res = await writeBlogArticle();
        if (!res) return NextResponse.json({ ok: true, skipped: true });
        return NextResponse.json(res);
    } catch (e) {
        console.error("cron blog failed", e instanceof Error ? e.message : "unknown");
        return NextResponse.json({ ok: false, message: "Blog writer failed" }, { status: 500 });
    }
}
