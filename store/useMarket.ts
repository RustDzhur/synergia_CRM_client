"use client";
import { marketOf, profile, type Market, type MarketProfile } from "@/lib/finance/market";
import { useFinanceStore } from "./useFinanceStore";

// Клиентское зеркало режима рынка (lib/finance/market.ts): меню, кнопки и плитки строятся из профиля,
// а не из проверок country === "UA" по месту.
//
// settings === null означает «настройки ещё не загружены» — это НЕ то же самое, что «страна не выбрана»:
// экран выбора страны нельзя показывать до загрузки, иначе он мигал бы при каждом входе в раздел.
export function useMarket(): { country: string; loaded: boolean; market: Market | null; profile: MarketProfile | null } {
    const settings = useFinanceStore((s) => s.settings);
    const country = settings?.country ?? "";
    const market = marketOf(country);
    return { country, loaded: settings !== null, market, profile: market ? profile(market) : null };
}
