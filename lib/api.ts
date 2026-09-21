import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { ProviderError } from "@/lib/http";
import { wasDenied } from "@/lib/auth";

// 403, если пользователь вошёл, но у его роли нет доступа к разделу (или фирма заблокирована); иначе 401
export const unauthorized = (req?: Request) =>
    wasDenied(req) ? NextResponse.json({ message: "You have no access to this section", code: "forbidden" }, { status: 403 }) : NextResponse.json({ message: "Unauthorized" }, { status: 401 });
export const badRequest = (message: string) => NextResponse.json({ message }, { status: 400 });
export const notFound = () => NextResponse.json({ message: "Not found" }, { status: 404 });
export const validId = (id: string) => isValidObjectId(id);

// Ошибки провайдера (неверный токен, номер не найден…) — 502 с понятным текстом; остальное — 500 без подробностей
export function failure(e: unknown) {
    if (e instanceof ProviderError) return NextResponse.json({ message: e.message }, { status: 502 });
    console.error(e);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
}

// Сбой сервера при входе/регистрации (нет переменных окружения, база недоступна): 503 с пометкой «server»,
// чтобы форма не выдавала это за неверный пароль. Подробности — только в логах и на /api/health.
export function serverError(e: unknown) {
    console.error(e);
    return NextResponse.json({ message: "Server is not available or not configured", code: "server" }, { status: 503 });
}
