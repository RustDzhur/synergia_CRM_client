import { errorToEvent, ingest, type ErrorSource } from "@/lib/errorHub";

// Скрытые ошибки приложения — упавший запрос, исключение в браузере, сбой синхронизации — уходят владельцу в Telegram с объяснением,
// что это и что проверить. Вся работа (отпечатки, повторы, лимиты, объяснение, отправка) — в lib/errorHub.ts; этот файл оставлен как
// привычная точка входа для кода сервера: reportError(error, { where, … }).

export interface ErrorContext {
    /** что делали: "API", "браузер", "синхронизация календарей" */
    where: string;
    /** фирма и человек, если известны */
    org?: string;
    user?: string;
    /** немного контекста: адрес запроса, разбираемое событие и подобное */
    detail?: Record<string, unknown>;
}

const sourceOf = (where: string): ErrorSource =>
    /браузер/i.test(where) ? "browser" : /cron|синхрониз|расписан|напоминан|автоматизац/i.test(where) ? "cron" : /провайдер|внешн|вебхук|webhook|telegram|whatsapp|messenger/i.test(where) ? "external" : "server";

/** Отчёт об ошибке. Никогда не бросает: сбой отчёта не должен ломать сам запрос. */
export async function reportError(error: unknown, ctx: ErrorContext): Promise<void> {
    await ingest(errorToEvent(error, { source: sourceOf(ctx.where), where: ctx.where, org: ctx.org, user: ctx.user, detail: ctx.detail }));
}
