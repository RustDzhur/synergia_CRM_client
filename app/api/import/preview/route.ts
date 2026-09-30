import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { IMPORT_KINDS, type ImportKind } from "@/lib/import/kinds";
import { previewImport } from "@/lib/import/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/import/preview — { kind, text, mapping? }: разобрать файл и показать, что получится.
// Ничего не пишет: предпросмотр с валидацией и есть «dry-run» (ТЗ §17 — второй шаг после
// сопоставления колонок). Большие файлы: 5000 строк каталога проверяются здесь же.

// Лимит тела запроса на Vercel — 4,5 МБ; мягко ограничим текст раньше, чтобы ошибка была понятной
const MAX_CHARS = 4_000_000;

export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => ({}));
    const kind = String(b?.kind ?? "") as ImportKind;
    if (!IMPORT_KINDS[kind]) return badRequest("unknown import kind");
    const text = typeof b?.text === "string" ? b.text : "";
    if (!text.trim()) return badRequest("file is empty");
    if (text.length > MAX_CHARS) return badRequest("file is too large for one run — split it");
    const mapping = b?.mapping && typeof b.mapping === "object" ? (b.mapping as Record<string, string>) : undefined;

    const preview = previewImport(kind, text, mapping);
    // В предпросмотр уходит ограниченная выборка строк: файл на 5000 строк не должен раздувать ответ,
    // счётчики при этом честные — по всему файлу
    return NextResponse.json({ ...preview, rows: preview.rows.slice(0, 200), truncated: preview.rows.length > 200 });
}
