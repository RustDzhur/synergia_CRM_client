import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized } from "@/lib/api";
import { runRule } from "@/lib/automation";
import SectionRecord from "@/models/SectionRecord";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// POST /api/automation/test — { id }: выполнить действие правила прямо сейчас на тестовых данных; результат виден в журнале (Test Logs)
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    if (typeof b?.id !== "string") return badRequest("Rule id is required");
    await connectDB();
    const row = await SectionRecord.findOne({ org: user.id, key: "automation:rules", rid: b.id });
    if (!row) return notFound();
    const sample = { id: "", name: "Test deal", stageId: "", stageName: "Test stage", contactName: "Test Client", email: "", title: "Test task", text: "Test message", from: "Test Sender", channel: "test", kind: "task", stage: "1h" };
    const res = await runRule(user.id, { id: row.rid, values: row.values as Record<string, string> }, { type: (row.values?.event as never) ?? "deal_created", data: sample, auto: true });
    return NextResponse.json(res);
}
