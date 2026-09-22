import FinanceSettings from "@/models/FinanceSettings";
import { defaultTaxRate } from "./taxRates";

// Настройки бухгалтерии фирмы с разумными умолчаниями, если она их ещё не заполняла (документ создаётся при первом обращении)
export async function financeSettings(org: string) {
    let s = await FinanceSettings.findOne({ org });
    if (!s) s = await FinanceSettings.create({ org }).catch(() => FinanceSettings.findOne({ org })); // на случай параллельного запроса
    return s!;
}

export const defaultRateFor = (s: { country?: string; smallBusiness?: boolean }) => defaultTaxRate(s.country ?? "", !!s.smallBusiness);
