import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, unauthorized } from "@/lib/api";
import { lookup, type LookupKind } from "@/lib/lookup";
import { cities, findDelivery } from "@/lib/finance/delivery";
import { marketOf } from "@/lib/finance/market";
import { financeSettings } from "@/lib/finance/settings";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/lookup?kind=company|address&q=…&country=DE|UA — подсказки для полей реквизитов и адресов
// (ТЗ §16). Провайдер выбирается по режиму рынка фирмы: ЕС — VIES (по номеру НДС), Украина — Нова
// Пошта (адреса по ключу фирмы) и демонстрационный ЄДР-провайдер до подключения платного.
// Ручной ввод работает всегда: пустой ответ — это не ошибка, а отсутствие подсказок.
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const url = new URL(req.url);
    const kind = url.searchParams.get("kind") as LookupKind | null;
    if (kind !== "company" && kind !== "address") return badRequest("kind must be company or address");
    const query = url.searchParams.get("q") ?? "";
    try {
            const settings = await financeSettings(user.id);
        const country = (url.searchParams.get("country") || marketOf(settings.country) || "DE").toUpperCase();
        // Адреса украинской фирмы ищет её же Новая Пошта: справочник общий, но ключ — фирмы
        const addressSearch =
            kind === "address" && country === "UA"
                ? async (q: string) => {
                      const doc = await findDelivery(user.id);
                      if (!doc) return [];
                      return cities(user.id, q);
                  }
                : undefined;
        const outcome = await lookup(kind, query, country, { addressSearch });
        return NextResponse.json(outcome);
    } catch (e) {
        return failure(e);
    }
}
