import FinanceSettings from "@/models/FinanceSettings";
import { MarketError } from "@/lib/http";
import { marketOf, marketAllowsIntegration, type Market, type MarketDocumentKind, marketHasDocument } from "./market";

// Серверная сторона режима рынка (см. lib/finance/market.ts — там сам режим и профиль).
//
// Каждый маршрут, который существует только для одного рынка, обязан спросить requireMarket:
// тогда немецкая фирма получает 409 на украинских маршрутах (ТТН НП, ПРРО, ссылки на оплату,
// маркетплейсы) и наоборот (Mahnwesen, BWA, SuSa, UStVA, EÜR, SEPA-QR). Иначе функции остаются
// доступными по прямой ссылке и режимы смешиваются.

/** Режим рынка фирмы по её настройкам бухгалтерии; null — страна ещё не выбрана. */
export async function orgMarket(org: string): Promise<Market | null> {
    const s = await FinanceSettings.findOne({ org }).select("country");
    return marketOf(s?.country);
}

const marketName: Record<Market, string> = { DE: "Германии", UA: "Украины" };

/** Отказ 409, если фирма работает не в этом режиме. Возвращает режим фирмы при успехе. */
export async function requireMarket(org: string, market: Market): Promise<Market> {
    const current = await orgMarket(org);
    if (current !== market) {
        throw new MarketError(`Функция доступна только для ${marketName[market]}`, market);
    }
    return current;
}

/** Проверка «документ доступен в режиме фирмы»: кнопки и маршруты выпуска документов спрашивают её до генерации. */
export async function requireDocument(org: string, kind: MarketDocumentKind): Promise<void> {
    const s = await FinanceSettings.findOne({ org }).select("country");
    if (!marketHasDocument(s?.country, kind)) {
        const m = marketOf(s?.country);
        throw new MarketError(m === "UA" ? "Документ не выпускается в режиме Украины" : "Документ доступен только для Украины", m === "UA" ? "DE" : "UA");
    }
}

/** Проверка «интеграция разрешена в режиме фирмы»: подключать украинские сервисы из немецкого режима нельзя.
 *  Пока страна не выбрана, общие подключения (мессенджеры, почта) не блокируются — фирма выбирает страну в настройках. */
export async function requireIntegration(org: string, type: string): Promise<void> {
    const s = await FinanceSettings.findOne({ org }).select("country");
    const m = marketOf(s?.country);
    if (m && !marketAllowsIntegration(m, type)) {
        const own = marketAllowsIntegration("UA", type) ? "UA" : "DE";
        throw new MarketError(`Функция доступна только для ${own === "UA" ? "Украины" : "Германии"}`, own);
    }
}
