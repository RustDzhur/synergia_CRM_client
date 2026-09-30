import FinanceSettings from "@/models/FinanceSettings";
import { marketOf, profile } from "./market";

// Настройки бухгалтерии фирмы с разумными умолчаниями, если она их ещё не заполняла (документ создаётся при первом обращении)
export async function financeSettings(org: string) {
    let s = await FinanceSettings.findOne({ org });
    if (!s) s = await FinanceSettings.create({ org }).catch(() => FinanceSettings.findOne({ org })); // на случай параллельного запроса
    return s!;
}

// Валюта по умолчанию для новых документов: валюта фирмы, а без неё — валюта её режима рынка
// (UAH для Украины, EUR для Германии). Раньше каждый маршрут молча подставлял EUR — украинская
// фирма получала евровый счёт, если фронт не прислал валюту (ТЗ, находка A17).
export async function defaultCurrency(org: string): Promise<string> {
    const s = await financeSettings(org);
    const own = String(s.currency ?? "").trim();
    if (own) return own;
    const market = marketOf(s.country);
    return market ? profile(market).currencyDefault : "EUR";
}
