import { NextResponse } from "next/server";
import { connectGate } from "@/lib/connect/http";
import { externalTools } from "@/lib/connect/tools";

export const dynamic = "force-dynamic";

// GET /api/connect/tools — список инструментов, доступных ключу (для n8n, Zapier и своих скриптов; для ИИ-клиентов проще MCP: /api/connect/mcp)
export async function GET(req: Request) {
    const gate = await connectGate(req);
    if ("res" in gate) return gate.res;
    const { conn } = gate;
    return NextResponse.json({ firm: conn.orgName, agent: conn.key.name, level: conn.key.level, approval: conn.key.approval, tools: externalTools(conn.ctx).map((t) => ({ name: t.def.name, description: t.def.description, write: t.write, parameters: t.def.parameters })) });
}
