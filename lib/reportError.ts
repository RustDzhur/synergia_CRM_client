import { sendTelegram } from "@/lib/channels/telegram";
import { secretsOf } from "@/lib/integrations";
import { errorBot } from "@/lib/platformSettings";
import { prisma } from "@/lib/prisma";

// Скрытые ошибки приложения — упавший запрос, исключение в браузере, сбой синхронизации — уходят
// в Telegram владельцу. Куда именно: сначала переменные окружения (TELEGRAM_ERROR_CHAT_ID и
// TELEGRAM_BOT_TOKEN), а если их нет — бот, подключённый к CRM, с чатом, который человек привязал
// командой /errors (см. app/api/webhooks/telegram). В переписку с клиентом ошибка не уйдёт никогда:
// адресат — только явно указанный чат.
//
// Одинаковые сообщения отправляем не чаще раза в десять минут: одна и та же поломка не должна
// заваливать чат сотней писем. Молча выходим, если отправлять некуда — ошибка всё равно останется
// в журнале Vercel, а сама отправка не имеет права ломать запрос, который её вызвал.

const THROTTLE_MS = 10 * 60_000;
const MAX_LENGTH = 3500;
const recent = new Map<string, number>();

export interface ErrorContext {
    /** что делали: "API", "браузер", "синхронизация календарей" */
    where: string;
    /** фирма и человек, если известны */
    org?: string;
    user?: string;
    /** немного контекста: адрес запроса, разбираемое событие и подобное */
    detail?: Record<string, unknown>;
}

/** Отчёт об ошибке. Никогда не бросает: сбой отчёта не должен ломать сам запрос. */
export async function reportError(error: unknown, ctx: ErrorContext): Promise<void> {
    try {
        const text = describe(error, ctx);
        const key = text.slice(0, 240);
        const now = Date.now();
        if (now - (recent.get(key) ?? 0) < THROTTLE_MS) return;
        recent.set(key, now);
        if (recent.size > 200) recent.clear();

        const target = await targetChat(ctx.org);
        if (!target) return;
        await sendTelegram(target.botToken, target.chatId, text.length > MAX_LENGTH ? `${text.slice(0, MAX_LENGTH - 1)}…` : text);
    } catch {
        // молча: отчёт об ошибке сам не должен её создавать
    }
}

function describe(error: unknown, ctx: ErrorContext): string {
    const name = error instanceof Error ? error.name : typeof error;
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error && error.stack ? error.stack.split("\n").slice(1, 6).map((l) => l.trim()).join("\n") : "";
    const detail = ctx.detail
        ? Object.entries(ctx.detail)
              .filter(([, v]) => v !== undefined && v !== "")
              .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
              .join("\n")
        : "";
    return [
        `🔴 Ошибка в приложении: ${ctx.where}`,
        `${name}: ${message}`,
        stack,
        detail,
        [ctx.org ? `фирма: ${ctx.org}` : "", ctx.user ? `пользователь: ${ctx.user}` : ""].filter(Boolean).join(", "),
        `время: ${new Date().toISOString()}`,
    ]
        .filter(Boolean)
        .join("\n\n");
}

/** Куда отправить: явные переменные окружения, иначе бот фирмы с привязанным чатом */
async function targetChat(org?: string): Promise<{ botToken: string; chatId: string } | null> {
    // Сначала отдельный бот отчётов: он задаётся в админке (или переменными окружения)
    const dedicated = await errorBot();
    if (dedicated.botToken && dedicated.chatId) return { botToken: dedicated.botToken, chatId: dedicated.chatId };

    const docs = await prisma.integration.findMany({ where: { type: "telegram", ...(org ? { owner: org } : {}) } }).catch(() => []);
    // чат должен быть привязан командой /errors — пустой config.errorChatId не годится
    const doc = docs.find((d) => String((d.config as any)?.errorChatId ?? "") !== "") ?? null;
    if (!doc) return null;
    const botToken = String(secretsOf<{ botToken?: string }>(doc).botToken ?? "");
    const chatId = String((doc.config as any)?.errorChatId ?? "");
    return botToken && chatId ? { botToken, chatId } : null;
}
