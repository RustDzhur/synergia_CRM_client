import { NextResponse } from "next/server";
import { aiConfigured } from "@/lib/ai/provider";
import { writeBlogArticle } from "@/lib/blogWriter";
import { findBlogRobot, recordBlogRun } from "@/lib/office/blogRobot";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// GET /api/cron/blog — ежедневный блог-робот внутри CRM: cron сервера каждые 10 минут
// («*/10 * * * *» + deploy/cron-blog.js), внутри — защита от дублей (не больше 2 статей в сутки,
// вторая не раньше чем через 8 часов — lib/blogWriter.ts). Публикует сразу (published: true),
// картинка — Openverse CC0/PD → public/images/blog/<slug>.jpg; на сайт статьи уезжают sync-blog.sh.
// Привязан к роботу Аде (шаблон p_blog, Робот-офис): Ада выключена или уволена — маршрут ничего не делает;
// каждая опубликованная статья (и сбой — не чаще раза в 6 часов) видна в Робот-офисе как поручение Аде.
export async function GET(req: Request) {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
    // Блог-cron — «руки» робота Ады из Робот-офиса: выключена или уволена Ада — ничего не пишем и ничего не шлём
    const robot = await findBlogRobot();
    if (!robot || !robot.enabled) return NextResponse.json({ ok: true, skipped: true, reason: robot ? "robot_off" : "no_robot" });
    if (!aiConfigured()) return NextResponse.json({ message: "AI is not configured on this site", code: "not_configured" }, { status: 503 });
    try {
        const res = await writeBlogArticle();
        if (!res) return NextResponse.json({ ok: true, skipped: true });
        await recordBlogRun(robot, { ok: true, slug: res.slug ?? "" });
        return NextResponse.json(res);
    } catch (e) {
        const error = e instanceof Error ? e.message : "unknown";
        console.error("cron blog failed", error);
        await recordBlogRun(robot, { ok: false, error });
        return NextResponse.json({ ok: false, message: "Blog writer failed" }, { status: 500 });
    }
}
