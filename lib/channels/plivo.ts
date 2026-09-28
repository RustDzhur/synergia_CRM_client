import { ProviderError, fetchProvider } from "@/lib/http";

// Plivo: обычная Basic-авторизация (auth_id и auth_token), поэтому ключи не нужно никуда подписывать.
// При подключении читаем данные аккаунта — это подтверждает, что auth_id с токеном рабочие.

export interface PlivoSecrets { authId: string; authToken: string }

async function plivo<T>(s: PlivoSecrets, path: string, method: "GET" | "POST", body?: unknown): Promise<T> {
    const res = await fetchProvider(
        `https://api.plivo.com/v1/Account/${encodeURIComponent(s.authId)}${path}`,
        {
            method,
            headers: {
                Authorization: "Basic " + Buffer.from(`${s.authId}:${s.authToken}`, "utf8").toString("base64"),
                ...(body === undefined ? {} : { "Content-Type": "application/json" }),
            },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        },
        15000
    );
    const json = (await res.json().catch(() => null)) as (T & { error?: string; message?: string }) | null;
    if (!res.ok) throw new ProviderError(json?.error ?? json?.message ?? `Plivo error ${res.status}`);
    return json as T;
}

/** Проверка ключей при подключении */
export async function verifyPlivo(s: PlivoSecrets): Promise<void> {
    await plivo<{ name?: string }>(s, "/", "GET");
}

export async function sendSms(s: PlivoSecrets, from: string, to: string, body: string): Promise<string> {
    // Plivo ждёт номер без «+»
    const res = await plivo<{ message_uuid?: string[] | string }>(s, "/Message/", "POST", { src: from.replace(/[^\d]/g, ""), dst: to.replace(/[^\d]/g, ""), text: body });
    const uuid = res.message_uuid;
    return Array.isArray(uuid) ? uuid[0] ?? "" : uuid ?? "";
}
