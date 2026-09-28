import { ProviderError, fetchProvider } from "@/lib/http";

// Telnyx: доступ по ключу API в заголовке Bearer. При подключении читаем список номеров —
// это подтверждает, что ключ рабочий, и заодно показывает, есть ли у аккаунта номера вообще.

export interface TelnyxSecrets { apiKey: string }

async function telnyx<T>(key: string, path: string, method: "GET" | "POST", body?: unknown): Promise<T> {
    const res = await fetchProvider(
        `https://api.telnyx.com/v2${path}`,
        {
            method,
            headers: { Authorization: `Bearer ${key}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        },
        15000
    );
    const json = (await res.json().catch(() => null)) as (T & { errors?: Array<{ detail?: string; title?: string }> }) | null;
    if (!res.ok) throw new ProviderError(json?.errors?.[0]?.detail ?? json?.errors?.[0]?.title ?? `Telnyx error ${res.status}`);
    return json as T;
}

/** Проверка ключей при подключении */
export async function verifyTelnyx(s: TelnyxSecrets): Promise<void> {
    await telnyx<unknown>(s.apiKey, "/phone_numbers?page[size]=1", "GET");
}

export async function sendSms(s: TelnyxSecrets, from: string, to: string, body: string): Promise<string> {
    const res = await telnyx<{ data?: { id?: string } }>(s.apiKey, "/messages", "POST", { from, to, text: body });
    return res.data?.id ?? "";
}
