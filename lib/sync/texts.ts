// Тексты записей ленты и уведомлений, которые пишет сервер. Хранится не готовая фраза, а ключ и параметры:
// "@@payment_full|{"number":"RE-1",…}". Интерфейс переводит их на язык пользователя (utils/fxText.ts,
// ключи — в messages/*.json, раздел feedText). Так лента клиента не смешивает языки: счёт, оплаченный
// немецкой фирмой, не появится в ней русской фразой.
export type FxParams = Record<string, string | number>;

export const fx = (key: string, params: FxParams = {}) => `@@${key}|${JSON.stringify(params)}`;

// Читаемый текст записи для серверных потребителей без интерфейса (ассистент Айрис, выгрузки): ключ раскрывается
// по английскому словарю. Обычный текст возвращается как есть.
import en from "@/messages/en.json";

export function plainFx(text: unknown): string {
    const s = String(text ?? "");
    if (!s.startsWith("@@")) return s;
    const bar = s.indexOf("|");
    const key = s.slice(2, bar < 0 ? undefined : bar);
    let params: Record<string, unknown> = {};
    try { if (bar >= 0) params = JSON.parse(s.slice(bar + 1)); } catch { /* параметры повреждены — подставятся пустые */ }
    const template = (en as unknown as { feedText: Record<string, string> }).feedText[key];
    if (!template) return key;
    return template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ""));
}
