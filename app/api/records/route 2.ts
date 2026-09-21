import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { canAccess, type Module } from "@/lib/access";
import { randomToken } from "@/lib/crypto";
import { effectivePlan } from "@/lib/billing";
import Organization from "@/models/Organization";
import SectionRecord from "@/models/SectionRecord";

export const dynamic = "force-dynamic";

const SECTIONS: Record<string, Module> = { automation: "automation", marketing: "marketing", inventory: "inventory" };
const INIT = "__init__";

// Ключ вида «раздел:вкладка»; доступ — по разделу (роль и разрешённые разделы участника)
function parseKey(key: unknown) {
    const m = typeof key === "string" ? key.match(/^([a-z]+):([a-z_]+)$/) : null;
    return m && SECTIONS[m[1]] ? { key: key as string, module: SECTIONS[m[1]] } : null;
}

const clean = (values: unknown) => {
    const out: Record<string, string> = {};
    if (values && typeof values === "object") for (const [k, v] of Object.entries(values as Record<string, unknown>).slice(0, 40)) if (/^[A-Za-z0-9_]{1,40}$/.test(k)) out[k] = String(v ?? "").slice(0, 1000);
    return out;
};

// GET /api/records?key=automation:rules → { initialized, records: [{ id, values }] }
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const k = parseKey(new URL(req.url).searchParams.get("key"));
    if (!k) return badRequest("Invalid key");
    if (!canAccess(user.role, user.modules, k.module, "GET")) return unauthorized(req);
    await connectDB();
    const list = await SectionRecord.find({ org: user.id, key: k.key }).sort({ createdAt: -1 });
    return NextResponse.json({ initialized: list.some((r) => r.rid === INIT), records: list.filter((r) => r.rid !== INIT).map((r) => ({ id: r.rid, values: r.values ?? {} })) });
}

// POST /api/records — { key, records: [{ id?, values }] }: создать или обновить записи (первая запись вкладки ставит отметку «инициализировано»)
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    const k = parseKey(b?.key);
    if (!k || !Array.isArray(b.records) || b.records.length > 200) return badRequest("Invalid data");
    if (!canAccess(user.role, user.modules, k.module, "POST")) return unauthorized(req);
    await connectDB();
    // число правил автоматизации зависит от тарифа фирмы (Free — 5, Standard — 30, Professional — 200)
    if (k.key === "automation:rules") {
        const org = await Organization.findById(user.id).select("plan planOverride planOverrideUntil");
        const limit = { free: 5, standard: 30, professional: 200 }[org ? effectivePlan(org) : "free"] ?? 5;
        const existing = new Set((await SectionRecord.find({ org: user.id, key: k.key, rid: { $ne: INIT } }).select("rid")).map((r) => r.rid));
        const added = b.records.filter((r: { id?: string }) => !r?.id || !existing.has(r.id)).length;
        if (existing.size + added > limit) return NextResponse.json({ message: `Your plan allows ${limit} automation rules. Upgrade the plan to add more.`, code: "plan_limit" }, { status: 402 });
    }
    await SectionRecord.updateOne({ org: user.id, key: k.key, rid: INIT }, { $setOnInsert: { values: {} } }, { upsert: true });
    const saved: { id: string; values: Record<string, string> }[] = [];
    for (const r of b.records) {
        const id = typeof r?.id === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(r.id) && r.id !== INIT ? r.id : randomToken(5);
        const values = clean(r?.values);
        await SectionRecord.updateOne({ org: user.id, key: k.key, rid: id }, { $set: { values } }, { upsert: true });
        saved.push({ id, values });
    }
    return NextResponse.json({ records: saved }, { status: 201 });
}

// DELETE /api/records — { key, ids: string[] }
export async function DELETE(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    const k = parseKey(b?.key);
    if (!k || !Array.isArray(b.ids)) return badRequest("Invalid data");
    if (!canAccess(user.role, user.modules, k.module, "DELETE")) return unauthorized(req);
    await connectDB();
    await SectionRecord.deleteMany({ org: user.id, key: k.key, rid: { $in: b.ids.filter((i: unknown) => typeof i === "string" && i !== INIT) } });
    return NextResponse.json({ ok: true });
}
