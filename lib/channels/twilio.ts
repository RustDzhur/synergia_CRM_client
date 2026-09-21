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
export async function connectTwilio(accountSid: string, authToken: string, phone: string, hookBase: string): Promise<{ secrets: TwilioSecrets; phone: string }> {
    const found = await call<{ incoming_phone_numbers: { sid: string; phone_number: string }[] }>(accountSid, authToken, `/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(phone)}`);
    const number = found.incoming_phone_numbers[0];
    if (!number) throw new ProviderError(await notFoundMessage(accountSid, authToken, phone));

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
    return { secrets: { accountSid, authToken, apiKeySid: key.sid, apiKeySecret: key.secret, appSid: app.sid }, phone: number.phone_number };
}

// Понятное сообщение, когда номера нет среди купленных: показываем, какие номера в аккаунте есть, и отличаем «подтверждённый Caller ID»
async function notFoundMessage(accountSid: string, authToken: string, phone: string) {
    let msg = `Number ${phone} was not found among the phone numbers of this Twilio account.`;
    try {
        const list = await call<{ incoming_phone_numbers: { phone_number: string }[] }>(accountSid, authToken, "/IncomingPhoneNumbers.json?PageSize=20");
        const owned = list.incoming_phone_numbers.map((n) => n.phone_number);
        msg += owned.length
            ? ` Numbers in this account: ${owned.join(", ")}.`
            : " This account has no phone numbers yet: buy one in Twilio Console → Phone Numbers → Buy a number.";
        if (!owned.length || !owned.includes(phone)) {
            const ids = await call<{ outgoing_caller_ids: unknown[] }>(accountSid, authToken, `/OutgoingCallerIds.json?PhoneNumber=${encodeURIComponent(phone)}`);
            if (ids.outgoing_caller_ids.length) msg += " This number is only a verified caller ID (e.g. your own mobile): Twilio cannot receive calls or SMS on it, you need a number bought in Twilio.";
        }
    } catch { /* подсказки — необязательные: показываем основное сообщение */ }
    return msg + " Also make sure the Account SID belongs to the account that owns the number.";
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

// В этих странах национальный номер пишут с нулём («0177…»), а в международном формате его нет: +49 177…, а не +49 0177…
const TRUNK_ZERO = ["380", "358", "353", "49", "46", "44", "43", "41", "33", "32", "31"];

// «+49 (151) 234-56» → «+4915123456»; «+49 0177 …» и «0049 177 …» → «+49177…»; null, если это не похоже на номер
export function normalizePhone(raw: string) {
    let v = raw.trim();
    if (/^00[1-9]/.test(v)) v = `+${v.slice(2)}`;
    if (!/^\+?[0-9 ()./-]{5,25}$/.test(v)) return null;
    let digits = v.replace(/\D/g, "");
    const cc = TRUNK_ZERO.find((c) => digits.startsWith(`${c}0`));
    if (cc) digits = cc + digits.slice(cc.length + 1);
    return digits.length >= 5 ? `+${digits}` : null;
}
