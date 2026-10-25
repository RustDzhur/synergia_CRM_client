import { NextResponse } from "next/server";
import { storageProblem } from "@/lib/storage";
import { prisma } from "@/lib/prisma";
import { missingTables } from "@/lib/schemaCheck";
import { ensurePlatformEnv, platformEnvCached } from "@/lib/platformEnv";

export const dynamic = "force-dynamic";

// GET /api/health — быстрая диагностика развёртывания: какие переменные окружения заданы и отвечает ли база.
// Значения переменных не показываются, только «есть / нет».
export async function GET() {
    const env = {
        DATABASE_URL: !!process.env.DATABASE_URL,
        JWT_SECRET: !!process.env.JWT_SECRET,
        APP_URL: !!process.env.APP_URL,
        LOCAL_STORAGE_ROOT: !!process.env.LOCAL_STORAGE_ROOT,
    };
    let db = "skipped (DATABASE_URL is not set)";
    if (env.DATABASE_URL) {
        try {
            await prisma.$queryRaw`SELECT 1`;
            db = "ok";
        } catch (e) {
            const m = e instanceof Error ? e.message : "";
            db = /auth|password|role .* does not exist|database .* does not exist/i.test(m)
                ? "PostgreSQL rejected the login: check the user, password and database name in DATABASE_URL"
                : /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|timed out/i.test(m)
                  ? "Cannot reach PostgreSQL: check that the database is running and reachable"
                  : "Database error";
        }
    }
    // Схема базы: после выкладки таблицы из schema.prisma должны существовать (иначе накатка схемы не прошла)
    let schema: string | string[] = "skipped";
    if (db === "ok") {
        try { const missing = await missingTables(); schema = missing.length ? missing : "ok"; } catch { schema = "unknown"; }
    }
    // Необязательные возможности: только «настроено или что не так», значения не раскрываются.
    // Ключи Google могут лежать в кабинете администратора (переменные окружения), поэтому
    // сначала подтягиваем их в кэш — иначе диагностика врала бы «не настроено».
    await ensurePlatformEnv().catch(() => undefined);
    const features = {
        storage: storageProblem() || "ok",
        googleSignIn: !!(platformEnvCached("GOOGLE_CLIENT_ID") && platformEnvCached("GOOGLE_CLIENT_SECRET")),
        googleAds: !!platformEnvCached("GOOGLE_ADS_DEVELOPER_TOKEN"),
        // Адреса возврата OAuth: ровно эти строки должны быть в Google Cloud Console
        // (Authorized redirect URIs), иначе Google отвечает redirect_uri_mismatch.
        googleRedirects: (() => {
            const origin = (process.env.APP_URL ?? "").replace(/\/+$/, "");
            return origin ? { ads: `${origin}/api/ads/callback`, mail: `${origin}/api/mail/oauth/callback` } : null;
        })(),
        admin: !!process.env.ADMIN_EMAILS,
        cron: !!process.env.CRON_SECRET,
    };
    const ok = env.DATABASE_URL && env.JWT_SECRET && db === "ok" && (schema === "ok" || schema === "unknown" || schema === "skipped");
    // Задеплоенный коммит: его пишет deploy/autodeploy.sh перед сборкой — видно, какая
    // версия кода сейчас живёт (как номер деплоя)
    const commit = process.env.DEPLOYED_COMMIT ?? "";
    return NextResponse.json({ ok, commit, env, db, schema, features }, { status: ok ? 200 : 503 });
}
