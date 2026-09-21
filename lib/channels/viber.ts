import { createHmac } from "crypto";
import { fetchProvider, ProviderError } from "@/lib/http";
import { safeEqual } from "@/lib/crypto";

const base = () => (process.env.VIBER_API_URL || "https://chatapi.viber.com/pa").replace(/\/+$/, "");

async function call<T extends { status: number; status_message?: string }>(authToken: string, method: string, body: Record<string, unknown> = {}): Promise<T> {
    const res = await fetchProvider(`${base()}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Viber-Auth-Token": authToken },
        body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as T | null;
    if (!json || json.status !== 0) throw new ProviderError(json?.status_message ?? `Viber error ${res.status}`);
    return json;
}

export const getAccount = (authToken: string) => call<{ status: number; name: string; uri?: string }>(authToken, "get_account_info");

export const setViberWebhook = (authToken: string, url: string) =>
    call(authToken, "set_webhook", { url, event_types: ["message", "unsubscribed"], send_name: true });

export const removeViberWebhook = (authToken: string) => call(authToken, "set_webhook", { url: "" });

export async function sendViber(authToken: string, botName: string, receiver: string, text: string) {
    const res = await call<{ status: number; message_token?: number }>(authToken, "send_message", {
        receiver,
        min_api_version: 1,
        sender: { name: botName.slice(0, 28) || "CRM" },
        type: "text",
        text,
    });
    return String(res.message_token ?? "");
}

// Viber подписывает тело запроса: hex HMAC-SHA256 с токеном бота в заголовке X-Viber-Content-Signature
export function verifyViberSignature(rawBody: string, signature: string | null, authToken: string) {
    if (!signature) return false;
    return safeEqual(createHmac("sha256", authToken).update(rawBody).digest("hex"), signature);
}

export function parseViberEvent(body: {
    event?: string;
    message_token?: number;
    sender?: { id: string; name?: string };
    message?: { type: string; text?: string };
}) {
    if (body.event !== "message" || !body.sender?.id || !body.message) return null;
    return {
        externalId: body.sender.id,
        name: body.sender.name || "Viber",
        text: body.message.type === "text" ? body.message.text ?? "" : `[${body.message.type}]`,
        messageId: body.message_token ? String(body.message_token) : undefined,
    };
}
