import { NextResponse } from "next/server";
import { authorizeAgent } from "@/lib/agents";
import { logAudit } from "@/lib/audit";
import { getFirmEnv, listFirmEnv } from "@/lib/firmEnv";
import { rateLimited } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Секретные переменные для внешних агентов (Harness и др.) — те, что администратор вносит в админке (общие «platform» или фирмы).
// Агент с правом «env» получает только перечисленные для него имена; каждое чтение пишется в журнал аудита. Значения нигде
// не кэшируются и не светятся в списках.
//   GET /api/agent/env?org=platform            — имена доступных агенту переменных (без значений)
//   GET /api/agent/env?org=platform&name=ИМЯ   — { name, value }; org по умолчанию "platform", для фирмы — её id
const deny = (why: "off" | "denied") =>
    why === "off" ? NextResponse.json({ message: "Agent access is not enabled" }, { status: 503 }) : NextResponse.json({ message: "Invalid token" }, { status: 401 });

export async function GET(req: Request) {
    const auth = await authorizeAgent(req, "env");
    if (auth.state !== "ok") return deny(auth.state);
    if (rateLimited(`agent-env:${auth.agent}`, 300, 3_600_000)) return NextResponse.json({ message: "Too many requests" }, { status: 429 });
    const q = new URL(req.url).searchParams;
    const org = (q.get("org") || "platform").trim();
    const name = (q.get("name") || "").trim().toUpperCase();
    const allowed = (n: string) => auth.envNames.includes("*") || auth.envNames.includes(n);
    if (!name) return NextResponse.json((await listFirmEnv(org)).filter((v) => allowed(v.name)).map((v) => ({ name: v.name, updatedAt: v.updatedAt })));
    if (!allowed(name)) return NextResponse.json({ message: `This agent may not read ${name}` }, { status: 403 });
    const value = await getFirmEnv(org, name);
    if (!value) return NextResponse.json({ message: "Not found" }, { status: 404 });
    await logAudit({ org, action: "env.agent_read", entityType: "env", entityId: name, summary: `Agent "${auth.agent}" read variable ${name}`, userName: `agent:${auth.agent}`, meta: {} });
    return NextResponse.json({ name, value });
}
