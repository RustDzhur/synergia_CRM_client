// Локальный адрес: localhost, IP-адрес, имя без точки или *.local. Публичный сайт всегда имеет доменное имя с точкой.
function isLocalHost(hostWithPort: string) {
    const name = hostWithPort.replace(/:\d+$/, "").toLowerCase();
    return name === "localhost" || name.startsWith("[") || /^\d+\.\d+\.\d+\.\d+$/.test(name) || !name.includes(".") || name.endsWith(".local");
}

// Публичный адрес сайта: по нему провайдеры (Telegram, Viber, Twilio, Meta) присылают вебхуки, а Google/Microsoft возвращают
// пользователя после входа. Порядок: APP_URL из окружения → заголовок x-forwarded-host (его ставит Vercel и другие прокси)
// → адрес самого запроса. Заголовок Host не используем: в режиме разработки Next подставляет в него внутренний адрес вида [::1]:53737.
export function appOrigin(req: Request) {
    const fromEnv = process.env.APP_URL?.replace(/\/+$/, "");
    if (fromEnv) return fromEnv;
    const forwarded = req.headers.get("x-forwarded-host")?.split(",")[0].trim();
    if (forwarded) {
        const proto = req.headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? (isLocalHost(forwarded) ? "http" : "https");
        return `${proto}://${forwarded}`;
    }
    return new URL(req.url).origin;
}

// Провайдеры принимают вебхуки только на публичный https-адрес
export const isPublicHttps = (origin: string) => {
    try {
        const u = new URL(origin);
        return u.protocol === "https:" && !isLocalHost(u.host);
    } catch {
        return false;
    }
};
