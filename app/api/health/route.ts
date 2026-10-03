import { NextResponse } from "next/server";
import { storageProblem } from "@/lib/storage";
import { prisma } from "@/lib/prisma";

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
    // Необязательные возможности: только «настроено или что не так», значения не раскрываются
    const features = {
        storage: storageProblem() || "ok",
        googleSignIn: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
        admin: !!process.env.ADMIN_EMAILS,
        cron: !!process.env.CRON_SECRET,
    };
    const ok = env.DATABASE_URL && env.JWT_SECRET && db === "ok";
    // Задеплоенный коммит: его пишет deploy/autodeploy.sh перед сборкой — видно, какая
    // версия кода сейчас живёт (как номер деплоя)
    const commit = process.env.DEPLOYED_COMMIT ?? "";
    return NextResponse.json({ ok, commit, env, db, features }, { status: ok ? 200 : 503 });
}
