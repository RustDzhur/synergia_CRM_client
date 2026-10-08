// Правила демо-кабинета без тяжёлых зависимостей: их проверяет и вход (lib/auth.ts), и выдача лимитов ИИ.

export const DEMO_DOMAIN = "demo.firmspace.invalid";
export const isDemoEmail = (email?: string | null) => !!email && email.toLowerCase().endsWith(`@${DEMO_DOMAIN}`);
export const DEMO_TTL_MS = 3 * 60 * 60 * 1000;
export const MAX_DEMOS = 60;
export const demoAiLimit = () => Math.max(0, Number(process.env.DEMO_AI_LIMIT ?? 8) || 0);

/** Что демо-пользователю нельзя: настройки, оплата, подключение внешних сервисов, звонки, загрузка файлов, чужие аккаунты. Ответ — 403 с кодом demo. */
export function demoBlocked(pathname: string, method: string): boolean {
    const p = pathname.replace(/^\/api\//, "");
    const first = p.split("/")[0];
    const read = method === "GET" || method === "HEAD";
    switch (first) {
        case "billing": case "env": case "connect": case "agents": case "agent": case "admin": case "errors": case "marketplace": case "hooks":
            return true;
        case "integrations": case "notify-settings": case "automation": case "webhooks": case "twilio": case "calls": case "sip": case "whatsapp": case "messenger":
        case "novaposhta": case "ukrposhta": case "onedrive": case "drive": case "documents": case "media": case "assets": case "ads":
            return !read;
        case "mail": return !read && /^mail\/accounts/.test(p);
        case "orgs": return !read; // создавать фирмы, приглашать людей, менять состав — нельзя
        case "ai": return /^ai\/(transcribe|tts)/.test(p);
        default: return false;
    }
}
