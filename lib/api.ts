import { NextResponse } from "next/server";
import { MarketError, ProviderError } from "@/lib/http";
import { ComplianceError } from "@/lib/finance/compliance";
import { reportError } from "@/lib/reportError";
import { wasDemoDenied, wasDenied, wasPlanDenied } from "@/lib/auth";
import { PeriodLockedError, lockedBody } from "@/lib/finance/periodLock";

// 403, если пользователь вошёл, но у его роли нет доступа к разделу (или фирма заблокирована); иначе 401.
// Отдельный код plan — раздел есть, но его нет в тарифе фирмы: интерфейс покажет предложение сменить тариф, а не «нет прав».
export const unauthorized = (req?: Request) => {
    if (wasDemoDenied(req)) return NextResponse.json({ message: "Not available in the demo", code: "demo" }, { status: 403 });
    if (wasPlanDenied(req)) return NextResponse.json({ message: "This section is not included in your plan", code: "plan" }, { status: 403 });
    if (wasDenied(req)) return NextResponse.json({ message: "You have no access to this section", code: "forbidden" }, { status: 403 });
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
};
export const badRequest = (message: string) => NextResponse.json({ message }, { status: 400 });
export const notFound = () => NextResponse.json({ message: "Not found" }, { status: 404 });
// id в новой схеме — строка: ObjectId-хекс (перенесённые из Mongo) или cuid (новые записи).
// Оба — компактные [0-9a-zA-Z_-]. Prisma на несуществующий id вернёт null → 404, поэтому здесь лишь дешёвая защита от мусора.
export const validId = (id: string): id is string => typeof id === "string" && id.length > 0 && id.length <= 40 && /^[A-Za-z0-9_-]+$/.test(id);

// Content-Disposition с именем файла, которое может быть не-ASCII: украинские номера документов —
// «КП-2026-1», «ВН-2026-4» — в HTTP-заголовке бросают TypeError (заголовки обязаны быть
// ASCII-совместимыми байтами ≤255), и маршрут отвечал «Server error», хотя PDF был уже готов —
// именно так выглядело «PDF в пропозициях не скачивается». Даём ASCII-запасное имя для старых
// браузеров и RFC 5987 filename* с точным именем для всех современных.
export function contentDisposition(filename: string, kind: "inline" | "attachment" = "inline"): string {
    const ascii = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_").slice(0, 120) || "document.pdf";
    // RFC 5987: кавычка, скобки и звёздочка не входят в attr-char и должны быть процент-кодированы
    const encoded = encodeURIComponent(filename).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
    return `${kind}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

// Ошибки провайдера (неверный токен, номер не найден…) — 502 с понятным текстом; остальное — 500 без подробностей.
// Неожиданные ошибки — то есть наши собственные поломки — уходят владельцу в Telegram (lib/reportError.ts):
// человек узнаёт о них, не дожидаясь, пока кто-нибудь пожалуется. Провайдерные не отправляем: их видно
// в интерфейсе, и это не поломка приложения, а ответ внешнего сервиса.
export function failure(e: unknown) {
    // Закрытый период: 423 с границами периода — интерфейс объяснит, что править можно только корректировкой в открытом периоде
    if (e instanceof PeriodLockedError) return NextResponse.json(lockedBody(e), { status: 423 });
    // Режим рынка: 409 и код market — интерфейс переведёт его сам (кому функция доступна)
    if (e instanceof MarketError) return NextResponse.json({ message: e.message, code: "market", market: e.market }, { status: 409 });
    // Чек-лист реквизитов: 400 со списком отсутствующих полей (ТЗ §14 — документ не выпускается)
    if (e instanceof ComplianceError) return NextResponse.json({ message: e.message, code: "compliance", missing: e.issues.map((i) => i.code) }, { status: 400 });
    if (e instanceof ProviderError) {
        // Неверный токен или номер — ошибка человека, молчим; а вот «не отвечает», «таймаут», 5xx у провайдера — поломка снаружи, о ней сообщаем
        if (/timeout|timed out|ECONN|ENOTFOUND|unavailable|недоступ|5\d\d|busy|out of quota/i.test(e.message)) void reportError(e, { where: "внешний сервис: ответ провайдера" });
        // заголовок говорит браузерному репортёру (ErrorReporter): это ответ внешнего сервиса с понятным текстом для человека, а не поломка приложения
        return NextResponse.json({ message: e.message }, { status: 502, headers: { "X-Provider-Error": "1" } });
    }
    console.error(e);
    void reportError(e, { where: "ошибка API" });
    return NextResponse.json({ message: "Server error" }, { status: 500 });
}

// Сбой сервера при входе/регистрации (нет переменных окружения, база недоступна): 503 с пометкой «server»,
// чтобы форма не выдавала это за неверный пароль. Подробности — в логах, на /api/health и в Telegram.
export function serverError(e: unknown) {
    console.error(e);
    void reportError(e, { where: "сервер недоступен или не настроен" });
    return NextResponse.json({ message: "Server is not available or not configured", code: "server" }, { status: 503 });
}
