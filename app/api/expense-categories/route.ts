import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { failure, unauthorized } from "@/lib/api";
import { financeSettings } from "@/lib/finance/settings";
import { loadExpenseCategories } from "@/lib/finance/expenseCatalogDb";
import { catalogName, datevAccountFor, type DatevChart } from "@/lib/finance/expenseCatalog";

export const dynamic = "force-dynamic";

// GET /api/expense-categories?chart=SKR03|SKR04&q= — справочник категорий расходов (ELSTER/DATEV).
// Две ветки дерева: категория (isGroup) и подкатегория с конкретным счётом. Отдаём оба названия
// и счёт сразу для выбранного плана — форма не делает второй запрос. Источник db/catalog виден
// в ответе: если seed ещё не накатан, интерфейс всё равно получает полный встроенный справочник.
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    try {
        const url = new URL(req.url);
        const settings = await financeSettings(user.id);
        const requested = url.searchParams.get("chart");
        const chart: DatevChart =
            requested === "SKR04" || requested === "SKR03"
                ? requested
                : settings.datevChart === "SKR04"
                  ? "SKR04"
                  : "SKR03";
        const { entries, source } = await loadExpenseCategories();
        const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
        const list = q
            ? entries.filter((e) => [e.code, e.nameDe, e.nameEn, e.nameRu, e.nameUa].some((v) => String(v).toLowerCase().includes(q)))
            : entries;
        return NextResponse.json({
            chart,
            source,
            categories: list.map((e) => ({
                code: e.code,
                parentCode: e.parentCode,
                isGroup: e.isGroup,
                name: { de: e.nameDe, en: e.nameEn, ru: e.nameRu, ua: e.nameUa },
                // Готовое название для текущего языка интерфейса: меньше логики в компоненте
                label: catalogName(e, url.searchParams.get("locale") ?? "de"),
                datev: { skr03: e.datevSkr03, skr04: e.datevSkr04 },
                account: datevAccountFor(e, chart),
                vatRate: e.vatRate,
                deductible: e.deductible,
                bookingKind: e.bookingKind,
                folder: e.folder,
                afaYears: e.afaYears,
                sortOrder: e.sortOrder,
            })),
        });
    } catch (e) {
        return failure(e);
    }
}
