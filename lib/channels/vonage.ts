import { ProviderError, fetchProvider } from "@/lib/http";

// Vonage (бывший Nexmo). Отправка — обычным POST на rest.nexmo.com, ключ и секрет идут в теле запроса,
// поэтому здесь нет ни заголовка авторизации, ни подписи. При подключении проверяем ключи запросом
// баланса: он подтверждает, что они рабочие, и ничего не меняет в аккаунте.
// Имя отправителя у Vonage может быть буквенным («Firmspace»), поэтому номер не приводим к формату.

export interface VonageSecrets { apiKey: string; apiSecret: string }

const BASE = "https://rest.nexmo.com";

async function vonage<T>(path: string, params: Record<string, string>): Promise<T> {
    const res = await fetchProvider(
        `${BASE}${path}`,
        { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params).toString() },
        15000
    );
    const json = (await res.json().catch(() => null)) as (T & { error_text?: string; "error-code-label"?: string }) | null;
    if (!res.ok) throw new ProviderError(json?.["error-code-label"] ?? json?.error_text ?? `Vonage error ${res.status}`);
    return json as T;
}

/** Проверка ключей при подключении */
export async function verifyVonage(s: VonageSecrets): Promise<void> {
    await vonage<{ value?: number }>("/account/get-balance", { api_key: s.apiKey, api_secret: s.apiSecret });
}

interface SmsResponse { messages?: Array<{ status?: string; "error-text"?: string; "message-id"?: string }> }

export async function sendSms(s: VonageSecrets, from: string, to: string, body: string): Promise<string> {
    // Vonage ждёт номер без «+» и без пробелов
    const res = await vonage<SmsResponse>("/sms/json", { api_key: s.apiKey, api_secret: s.apiSecret, from, to: to.replace(/[^\d]/g, ""), text: body });
    const first = res.messages?.[0];
    // У Vonage ошибка приходит внутри успешного ответа: status «0» означает принято
    if (!first || first.status !== "0") throw new ProviderError(first?.["error-text"] ?? "Vonage did not accept the message");
    return first["message-id"] ?? "";
}
