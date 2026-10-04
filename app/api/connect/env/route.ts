import { NextResponse } from "next/server";
import { connectGate } from "@/lib/connect/http";
import { logAudit } from "@/lib/audit";
import { getFirmEnv, listFirmEnv } from "@/lib/firmEnv";

export const dynamic = "force-dynamic";

// Переменные окружения фирмы для её агента или бота (ключ «Подключить агента или бота»). Агент видит только те имена, которые владелец
// разрешил в ключе; значения отдаются по одному, каждое чтение пишется в журнал действий фирмы.
//   GET /api/connect/env            — список разрешённых имён (которые реально заданы)
//   GET /api/connect/env?name=ИМЯ   — { name, value }
export async function GET(req: Request) {
    const gate = await connectGate(req);
    if ("res" in gate) return gate.res;
    const { conn } = gate;
    const allowed = (n: string) => conn.key.envNames.includes("*") || conn.key.envNames.includes(n);
    const name = (new URL(req.url).searchParams.get("name") ?? "").trim().toUpperCase();
    if (!name) return NextResponse.json((await listFirmEnv(conn.org)).filter((v) => allowed(v.name)).map((v) => ({ name: v.name, updatedAt: v.updatedAt })));
    if (!allowed(name)) return NextResponse.json({ message: `This key may not read ${name}. The owner allows variables when creating the key.` }, { status: 403 });
    const value = await getFirmEnv(conn.org, name);
    if (!value) return NextResponse.json({ message: "Not found" }, { status: 404 });
    await logAudit({ org: conn.org, action: "env.agent_read", entityType: "env", entityId: name, summary: `Agent "${conn.key.name}" read variable ${name}`, userName: `agent:${conn.key.name}`, meta: {} });
    return NextResponse.json({ name, value });
}
