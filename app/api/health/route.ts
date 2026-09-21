import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";

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
    const ok = env.MONGODB_URI && env.JWT_SECRET && db === "ok";
    return NextResponse.json({ ok, env, db }, { status: ok ? 200 : 503 });
}
