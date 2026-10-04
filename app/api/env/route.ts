import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { deleteFirmEnv, getFirmEnv, listFirmEnv, setFirmEnv } from "@/lib/firmEnv";

export const dynamic = "force-dynamic";

// Переменные окружения ФИРМЫ — своими руками, в своём кабинете (Настройки → Интеграции → «Переменные окружения»). Сюда клиент вносит ключи
// своих сервисов (API доставки, склада, почтового сервиса…); в правилах автоматизации они доступны как {{env.ИМЯ}} (например, в адресе
// вебхука), а внешний агент, подключённый ключом, читает разрешённые ему переменные через /api/connect/env. Значения шифруются в базе.
// Доступ — по правам раздела «Настройки» (владелец и администраторы), как и у остальных интеграций.
//   GET            — имена, длины и даты (значения не отдаются);  GET ?reveal=ИМЯ — значение одной переменной (с записью в аудит)
//   PUT { name, value } — задать или заменить;  DELETE ?name=ИМЯ — удалить
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const reveal = new URL(req.url).searchParams.get("reveal");
    if (reveal) {
        const name = reveal.trim().toUpperCase();
        const value = await getFirmEnv(user.id, name);
        if (!value) return NextResponse.json({ message: "Not found" }, { status: 404 });
        await logAudit({ org: user.id, userId: user.userId, action: "env.reveal", entityType: "env", entityId: name, summary: `Variable ${name} revealed`, meta: {} });
        return NextResponse.json({ name, value });
    }
    return NextResponse.json(await listFirmEnv(user.id));
}

export async function PUT(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = (await req.json().catch(() => ({}))) as { name?: unknown; value?: unknown };
    const name = String(b.name ?? "").trim().toUpperCase();
    try {
        await setFirmEnv(user.id, name, String(b.value ?? ""), user.userId);
    } catch (e) {
        return badRequest(e instanceof Error ? e.message : "Invalid variable");
    }
    await logAudit({ org: user.id, userId: user.userId, action: "env.set", entityType: "env", entityId: name, summary: `Variable ${name} set`, meta: {} }).catch(() => undefined);
    return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const name = (new URL(req.url).searchParams.get("name") ?? "").trim().toUpperCase();
    if (!(await deleteFirmEnv(user.id, name))) return NextResponse.json({ message: "Not found" }, { status: 404 });
    await logAudit({ org: user.id, userId: user.userId, action: "env.delete", entityType: "env", entityId: name, summary: `Variable ${name} deleted`, meta: {} }).catch(() => undefined);
    return NextResponse.json({ ok: true });
}
