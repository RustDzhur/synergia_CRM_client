import { NextResponse } from "next/server";
import { connectGate } from "@/lib/connect/http";
import { callExternal } from "@/lib/connect/tools";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/connect/tools/<имя> — тело: аргументы инструмента (JSON). Ответ: { status: "done", result } или
// { status: "pending_approval", requestId } — изменение ждёт одобрения владельца. Ошибка: { error } со статусом 400.
export async function POST(req: Request, { params }: { params: { name: string } }) {
    const gate = await connectGate(req);
    if ("res" in gate) return gate.res;
    const args = await req.json().catch(() => ({}));
    const r = await callExternal(gate.conn.ctx, gate.conn.key, params.name, args);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json(r.status === "done" ? { status: "done", result: r.result } : { status: r.status, requestId: r.requestId, note: r.note });
}
