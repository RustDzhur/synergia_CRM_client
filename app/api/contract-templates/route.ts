import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { cleanBody } from "@/lib/finance/contractHtml";

export const dynamic = "force-dynamic";

// Шаблоны договоров фирмы: неограниченное число (аренда, найм, подряд…). Каждый шаблон — текст
// с подстановками {{key}} и список произвольных полей fields: [{key,label,type,source}].
// Поля печатаются в PDF на месте {{key}} (lib/finance/contractText.ts + lib/finance/document.ts).

const toDTO = (t: any) => ({
    id: t.id,
    name: t.name,
    body: t.body ?? "",
    fields: Array.isArray(t.fields) ? t.fields : [],
    active: !!t.active,
});

const cleanField = (f: any) => {
    const key = String(f?.key ?? "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 60);
    const label = String(f?.label ?? "").trim().slice(0, 100);
    if (!key || !label) return null;
    const type = ["text", "date", "number", "money"].includes(f?.type) ? f.type : "text";
    const source = f?.source === "contact" ? "contact" : "manual";
    return { key, label, type, source };
};

export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const list = await prisma.contractTemplate.findMany({ where: { org: user.id, active: true }, orderBy: { name: "asc" } });
    return NextResponse.json(list.map(toDTO));
}

export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    const name = String(b?.name ?? "").trim().slice(0, 120);
    if (!name) return badRequest("name is required");
    const body = cleanBody(b?.body);
    const fields = (Array.isArray(b?.fields) ? b.fields : []).map(cleanField).filter(Boolean).slice(0, 200);
    const t = await prisma.contractTemplate.create({ data: { org: user.id, name, body, fields } });
    return NextResponse.json(toDTO(t), { status: 201 });
}
