import { createHmac } from "crypto";
import jwt from "jsonwebtoken";
import { fetchProvider, ProviderError } from "@/lib/http";
import { safeEqual } from "@/lib/crypto";

const base = () => (process.env.TWILIO_API_URL || "https://api.twilio.com/2010-04-01").replace(/\/+$/, "");

export interface TwilioSecrets {
    accountSid: string;
    authToken: string;
    apiKeySid: string; // ключ и приложение создаются автоматически при подключении — они нужны для звонков из браузера
    apiKeySecret: string;
    appSid: string;
}

async function call<T>(accountSid: string, authToken: string, path: string, form?: Record<string, string>): Promise<T> {
    const res = await fetchProvider(`${base()}/Accounts/${accountSid}${path}`, {
        method: form ? "POST" : "GET",
        headers: {
            Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
            ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        },
        body: form ? new URLSearchParams(form).toString() : undefined,
    });
    const json = (await res.json().catch(() => null)) as (T & { message?: string }) | null;
    if (!res.ok || !json) throw new ProviderError(json?.message ?? `Twilio error ${res.status}`);
    return json;
}

// Подключение: проверяем ключи, находим номер и настраиваем его вебхуки, создаём API-ключ и TwiML-приложение для звонков из браузера
export async function connectTwilio(accountSid: string, authToken: string, phone: string, hookBase: string): Promise<TwilioSecrets> {
    const found = await call<{ incoming_phone_numbers: { sid: string }[] }>(accountSid, authToken, `/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(phone)}`);
    const number = found.incoming_phone_numbers[0];
    if (!number) throw new ProviderError(`Number ${phone} was not found in this Twilio account`);

    const app = await call<{ sid: string }>(accountSid, authToken, "/Applications.json", {
        FriendlyName: "Firmspace CRM",
        VoiceUrl: `${hookBase}/voice`,
        VoiceMethod: "POST",
    });
    const key = await call<{ sid: string; secret: string }>(accountSid, authToken, "/Keys.json", { FriendlyName: "Firmspace CRM" });
    await call(accountSid, authToken, `/IncomingPhoneNumbers/${number.sid}.json`, {
        SmsUrl: `${hookBase}/sms`,
        SmsMethod: "POST",
        VoiceUrl: `${hookBase}/voice`,
        VoiceMethod: "POST",
    });
    return { accountSid, authToken, apiKeySid: key.sid, apiKeySecret: key.secret, appSid: app.sid };
}

export async function sendSms(s: TwilioSecrets, from: string, to: string, body: string) {
    const res = await call<{ sid: string }>(s.accountSid, s.authToken, "/Messages.json", { From: from, To: to, Body: body });
    return res.sid;
}

// Токен для Twilio Voice SDK в браузере: JWT, подписанный секретом API-ключа
export function voiceAccessToken(s: TwilioSecrets, identity: string, ttl = 3600) {
    const now = Math.floor(Date.now() / 1000);
    return jwt.sign(
        {
            jti: `${s.apiKeySid}-${now}`,
            iss: s.apiKeySid,
            sub: s.accountSid,
            nbf: now,
            exp: now + ttl,
            grants: { identity, voice: { incoming: { allow: true }, outgoing: { application_sid: s.appSid } } },
        },
        s.apiKeySecret,
        { algorithm: "HS256", header: { alg: "HS256", typ: "JWT", cty: "twilio-fpa;v=1" } }
    );
}

// Подпись Twilio: base64 HMAC-SHA1 от «полный URL + параметры формы, отсортированные по имени, имя+значение подряд»
export function twilioSignature(url: string, params: Record<string, string>, authToken: string) {
    const data = Object.keys(params).sort().reduce((acc, k) => acc + k + params[k], url);
    return createHmac("sha1", authToken).update(data).digest("base64");
}

export function verifyTwilioSignature(url: string, params: Record<string, string>, header: string | null, authToken: string) {
    return !!header && safeEqual(twilioSignature(url, params, authToken), header);
}

export const xmlEscape = (s: string) => s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c] as string);
export const twiml = (inner = "") => new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`, { headers: { "Content-Type": "text/xml" } });

// «+49 (151) 234-56» → «+4915123456»; null, если это не похоже на номер
export function normalizePhone(raw: string) {
    const v = raw.trim();
    if (!/^\+?[0-9 ()./-]{5,25}$/.test(v)) return null;
    const digits = v.replace(/\D/g, "");
    return digits.length >= 5 ? `+${digits}` : null;
}
