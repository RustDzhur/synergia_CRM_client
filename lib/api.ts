import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { ProviderError } from "@/lib/http";

export const unauthorized = () => NextResponse.json({ message: "Unauthorized" }, { status: 401 });
export const badRequest = (message: string) => NextResponse.json({ message }, { status: 400 });
export const notFound = () => NextResponse.json({ message: "Not found" }, { status: 404 });
export const validId = (id: string) => isValidObjectId(id);

// Ошибки провайдера (неверный токен, номер не найден…) — 502 с понятным текстом; остальное — 500 без подробностей
export function failure(e: unknown) {
    if (e instanceof ProviderError) return NextResponse.json({ message: e.message }, { status: 502 });
    console.error(e);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
}
