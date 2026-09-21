// Публичный адрес сайта: по нему провайдеры (Telegram, Twilio, Viber, Meta) присылают вебхуки.
// На проде — APP_URL из окружения (например https://crm.example.com), иначе берём из заголовков запроса.
export function appOrigin(req: Request) {
    const fromEnv = process.env.APP_URL?.replace(/\/+$/, "");
    if (fromEnv) return fromEnv;
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
    const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
    return `${proto}://${host}`;
}

// Провайдеры принимают вебхуки только на публичный https-адрес
export const isPublicHttps = (origin: string) => /^https:\/\//.test(origin) && !/localhost|127\.0\.0\.1/.test(origin);
