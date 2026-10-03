import { NextResponse } from "next/server";
import { connectGate } from "@/lib/connect/http";
import { callExternal, externalTools } from "@/lib/connect/tools";
import type { Connection } from "@/lib/connect/keys";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// MCP-сервер Firmspace (Model Context Protocol, Streamable HTTP, JSON-RPC 2.0). Один адрес и один ключ — и любой ИИ-клиент
// (Claude, ChatGPT, Cursor, DeepSeek Harness, n8n…) получает инструменты Айрис: поиск контактов и сделок, счета, склад, задачи,
// отчёты, создание записей. Что именно доступно, решает ключ (CRM → Настройки → Интеграции → «Подключить агента»).
// Подробно — docs/CONNECT.md.
const PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];

type Rpc = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };
const ok = (id: Rpc["id"], result: unknown) => ({ jsonrpc: "2.0", id: id ?? null, result });
const fail = (id: Rpc["id"], code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

async function handle(conn: Connection, m: Rpc): Promise<unknown | null> {
    const id = m.id;
    if (m.id === undefined) return null; // уведомление (notifications/initialized и т.п.) — ответа нет
    switch (m.method) {
        case "initialize": {
            const want = String(m.params?.protocolVersion ?? "");
            return ok(id, {
                protocolVersion: PROTOCOLS.includes(want) ? want : PROTOCOLS[0],
                capabilities: { tools: { listChanged: false } },
                serverInfo: { name: "Firmspace", version: "1.0.0" },
                instructions: `You are connected to the firm "${conn.orgName}" in Firmspace CRM as agent "${conn.key.name}" (${conn.key.level === "work" ? "can read and propose/make changes" : "read-only"}). ${conn.key.approval ? "Changes are not applied immediately: they wait for the owner's approval, and the call returns pending_approval." : "Changes are applied immediately."} Use the tools to read CRM data and to create or change records.`,
            });
        }
        case "ping": return ok(id, {});
        case "tools/list":
            return ok(id, { tools: externalTools(conn.ctx).map((t) => ({ name: t.def.name, description: t.def.description, inputSchema: t.def.parameters, annotations: { readOnlyHint: !t.write, destructiveHint: false } })) });
        case "tools/call": {
            const name = String(m.params?.name ?? "");
            const r = await callExternal(conn.ctx, conn.key, name, m.params?.arguments);
            const text = r.ok ? JSON.stringify(r.status === "done" ? r.result : { status: r.status, requestId: r.requestId, note: r.note }) : r.error;
            return ok(id, { content: [{ type: "text", text }], isError: !r.ok });
        }
        default: return fail(id, -32601, `Method not found: ${m.method}`);
    }
}

export async function POST(req: Request) {
    const gate = await connectGate(req);
    if ("res" in gate) return gate.res;
    const body = (await req.json().catch(() => null)) as Rpc | Rpc[] | null;
    if (!body) return NextResponse.json(fail(null, -32700, "Parse error"), { status: 400 });
    const batch = Array.isArray(body);
    const out = (await Promise.all((batch ? body : [body]).map((m) => handle(gate.conn, m)))).filter((x) => x !== null);
    if (!out.length) return new Response(null, { status: 202 }); // были только уведомления
    return NextResponse.json(batch ? out : out[0]);
}

// Потоковый канал сервер→клиент не нужен: все ответы приходят на POST. Для остальных методов спецификация разрешает 405.
export async function GET() { return new Response(null, { status: 405, headers: { Allow: "POST" } }); }
export async function DELETE() { return new Response(null, { status: 405, headers: { Allow: "POST" } }); }
