// Тексты записей ленты и уведомлений, которые пишет сервер. Хранится не готовая фраза, а ключ и параметры:
// "@@payment_full|{"number":"RE-1",…}". Интерфейс переводит их на язык пользователя (utils/fxText.ts,
// ключи — в messages/*.json, раздел feedText). Так лента клиента не смешивает языки: счёт, оплаченный
// немецкой фирмой, не появится в ней русской фразой.
export type FxParams = Record<string, string | number>;

export const fx = (key: string, params: FxParams = {}) => `@@${key}|${JSON.stringify(params)}`;
