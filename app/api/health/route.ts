import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { storageProblem } from "@/lib/storage/firebase";

export const dynamic = "force-dynamic";

// GET /api/health — быстрая диагностика развёртывания: какие переменные окружения заданы и отвечает ли база.
// Значения переменных не показываются, только «есть / нет».
export async function GET() {
    const env = {
        MONGODB_URI: !!process.env.MONGODB_URI,
        JWT_SECRET: !!process.env.JWT_SECRET,
        APP_URL: !!process.env.APP_URL,
    };
    let db = "skipped (MONGODB_URI is not set)";
    if (env.MONGODB_URI) {
        try {
            await connectDB();
            db = "ok";
        } catch (e) {
            const m = e instanceof Error ? e.message : "";
            db = /auth/i.test(m)
                ? "MongoDB rejected the login: check the user and password in MONGODB_URI"
                : /server selection|timed out|ENOTFOUND|ECONN|whitelist|IP/i.test(m)
                  ? "Cannot reach MongoDB: in Atlas open Network Access and allow 0.0.0.0/0 for Vercel"
                  : "Database error";
        }
    }
    // Необязательные возможности: только «настроено или что не так», значения не раскрываются
    const features = {
        storage: storageProblem() || "ok",
        stripe: !!process.env.STRIPE_SECRET_KEY,
        stripeWebhook: (process.env.STRIPE_WEBHOOK_SECRET ?? "").startsWith("whsec_"),
        googleSignIn: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
        admin: !!process.env.ADMIN_EMAILS,
        cron: !!process.env.CRON_SECRET,
    };
    const ok = env.MONGODB_URI && env.JWT_SECRET && db === "ok";
    return NextResponse.json({ ok, env, db, features }, { status: ok ? 200 : 503 });
}
