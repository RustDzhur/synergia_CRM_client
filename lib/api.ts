import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { MarketError, ProviderError } from "@/lib/http";
import { reportError } from "@/lib/reportError";
import { wasDenied, wasPlanDenied } from "@/lib/auth";

// 403, если пользователь вошёл, но у его роли нет доступа к разделу (или фирма заблокирована); иначе 401.
// Отдельный код plan — раздел есть, но его нет в тарифе фирмы: интерфейс покажет предложение сменить тариф, а не «нет прав».
export const unauthorized = (req?: Request) => {
    if (wasPlanDenied(req)) return NextResponse.json({ message: "This section is not included in your plan", code: "plan" }, { status: 403 });
    if (wasDenied(req)) return NextResponse.json({ message: "You have no access to this section", code: "forbidden" }, { status: 403 });
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
};
export const badRequest = (message: string) => NextResponse.json({ message }, { status: 400 });
export const notFound = () => NextResponse.json({ message: "Not found" }, { status: 404 });
export const validId = (id: string) => isValidObjectId(id);

// Ошибки провайдера (неверный токен, номер не найден…) — 502 с понятным текстом; остальное — 500 без подробностей.
// Неожиданные ошибки — то есть наши собственные поломки — уходят владельцу в Telegram (lib/reportError.ts):
// человек узнаёт о них, не дожидаясь, пока кто-нибудь пожалуется. Провайдерные не отправляем: их видно
// в интерфейсе, и это не поломка приложения, а ответ внешнего сервиса.
export function failure(e: unknown) {
    // Режим рынка: 409 и код market — интерфейс переведёт его сам (кому функция доступна)
    if (e instanceof MarketError) return NextResponse.json({ message: e.message, code: "market", market: e.market }, { status: 409 });
    if (e instanceof ProviderError) return NextResponse.json({ message: e.message }, { status: 502 });
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
