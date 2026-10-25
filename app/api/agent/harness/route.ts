import { NextResponse } from "next/server";
import { authorizeAgent } from "@/lib/agents";
import { claimHarnessTask, completeHarnessTask, harnessOrg, listHarnessRequests } from "@/lib/office/harnessBridge";

export const dynamic = "force-dynamic";

// Очередь задач для облачного агента Harness (право токена «harness»).
//   GET  /api/agent/harness            — забрать ближайшую задачу (queued → running) или { task: null }
//   GET  /api/agent/harness?peek=1     — посмотреть очередь, ничего не забирая
//   POST /api/agent/harness            — { id, result, ok } — вернуть результат; владелец получает задачу в CRM
const denied = (why: "off" | "denied") =>
    why === "off"
        ? NextResponse.json({ message: "Agent access is not enabled: create an agent in the CRM (Settings → Integration → Agents)" }, { status: 503 })
        : NextResponse.json({ message: "Invalid token" }, { status: 401 });

export async function GET(req: Request) {
    const auth = await authorizeAgent(req, "harness");
    if (auth.state !== "ok") return denied(auth.state);
    const org = await harnessOrg();
    if (!org) return NextResponse.json({ task: null, message: "No platform workspace found for the queue" });
    const peek = new URL(req.url).searchParams.get("peek") === "1";
    if (peek) {
        const queued = (await listHarnessRequests(org, 50)).filter((r) => r.status === "queued");
        return NextResponse.json({ queued: queued.slice(0, 10) });
    }
    const task = await claimHarnessTask(org);
    return NextResponse.json({ task });
}

export async function POST(req: Request) {
    const auth = await authorizeAgent(req, "harness");
    if (auth.state !== "ok") return denied(auth.state);
    const org = await harnessOrg();
    if (!org) return NextResponse.json({ message: "No platform workspace found for the queue" }, { status: 404 });
    const body = (await req.json().catch(() => ({}))) as { id?: string; result?: string; ok?: boolean };
    if (!body.id || typeof body.result !== "string") return NextResponse.json({ message: "id and result are required" }, { status: 400 });
    const done = await completeHarnessTask(org, String(body.id), { result: body.result, ok: body.ok !== false });
    if (!done) return NextResponse.json({ message: "Task not found" }, { status: 404 });
    return NextResponse.json({ ok: true, status: done.status });
}
