import { fetchProvider } from "@/lib/http";
import { irisBot, setIrisBot } from "@/lib/firmNotify";
import { prisma } from "@/lib/prisma";
import { invoicePdfBuffer, pdfLocale } from "@/lib/finance/document";
import { findInvoice } from "@/lib/finance/aiActions";
import { transcribeAudio } from "./provider";
import { dailyLimit, log, runChat, takeQuota, type ChatResult, type PendingAction } from "./run";
import { type AiCtx, ToolError, allowedTools } from "./tools";
import { langOf } from "./fastReply";
import { runTasks } from "./jobs";

// Управление Айрис из Telegram. Человек пишет (или наговаривает голосовым) ОТДЕЛЬНОМУ боту Айрис — не тому, что присылает
// рабочие уведомления (Настройки → Интеграции → «Бот Айрис») — а Айрис делает это в CRM и отвечает в чат.
//
// Как это устроено:
//  • сервер сам забирает сообщения (getUpdates каждые пару секунд): у домашнего сервера нет входящего IPv4, вебхук Telegram
//    до него не дошёл бы, а исходящее соединение работает всегда;
//  • слушаем ТОЛЬКО чат, сохранённый в настройках бота Айрис (notify.iris.chatId) — это чат того, кто подключал бота; чужие сообщения
//    игнорируются, действия выполняются с правами этого человека;
//  • изменения выполняются сразу (в Telegram нет кнопок «Подтвердить»), кроме удаления и случаев, когда Айрис читала чужой
//    текст: тогда она спрашивает, и достаточно ответить «да» / «нет»;
//  • длинное сообщение с несколькими поручениями идёт в очередь: результат каждой приходит отдельным сообщением.

const base = () => (process.env.TELEGRAM_API_URL || "https://api.telegram.org").replace(/\/+$/, "");

async function tg<T>(token: string, method: string, body: Record<string, unknown> = {}, ms = 20000): Promise<T> {
    const res = await fetchProvider(`${base()}/bot${token}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, ms);
    const json = (await res.json().catch(() => null)) as { ok: boolean; result: T; description?: string } | null;
    if (!json?.ok) throw new Error(json?.description ?? `Telegram error ${res.status}`);
    return json.result;
}

export interface TgMessage {
    message_id: number;
    date: number;
    chat: { id: number; type: string };
    from?: { id: number; is_bot?: boolean };
    text?: string;
    voice?: { file_id: string; mime_type?: string; duration?: number };
    audio?: { file_id: string; mime_type?: string };
}
export interface TgUpdate { update_id: number; message?: TgMessage }

/** Telegram принимает до 4096 знаков за сообщение — длинное режем по строкам. */
export function chunkText(text: string, max = 3800): string[] {
    const out: string[] = [];
    let cur = "";
    for (const line of String(text).split("\n")) {
        if ((cur + "\n" + line).length > max) { if (cur) out.push(cur); cur = line.slice(0, max); }
        else cur = cur ? `${cur}\n${line}` : line;
    }
    if (cur) out.push(cur);
    return out.length ? out : [""];
}

const YES = ["да", "ок", "окей", "давай", "подтверждаю", "подтверди", "выполняй", "делай", "отправляй", "так", "гаразд", "добре", "yes", "ok", "okay", "ja", "go"];
const NO = ["нет", "отмена", "отмени", "не надо", "не нужно", "ні", "скасуй", "no", "nein", "cancel"];
const words = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
export const isYes = (t: string) => { const w = words(t); return w.length > 0 && w.length <= 4 && w.some((x) => YES.includes(x)); };
export const isNo = (t: string) => { const w = words(t); return w.length > 0 && w.length <= 4 && w.some((x) => NO.includes(x)); };

// ── состояние разговоров (в памяти процесса; живёт полчаса после последней реплики) ──
interface Chat { history: { role: "user" | "assistant"; text: string }[]; pending: PendingAction[]; at: number; busy: boolean }
const g = globalThis as { __irisTg?: Map<string, Chat> };
const chats = (g.__irisTg ??= new Map<string, Chat>());
function chatState(key: string): Chat {
    const now = Date.now();
    chats.forEach((c, k) => { if (now - c.at > 30 * 60_000) chats.delete(k); });
    let c = chats.get(key);
    if (!c) { c = { history: [], pending: [], at: now, busy: false }; chats.set(key, c); }
    c.at = now;
    return c;
}

export interface ControlDeps {
    ctx: AiCtx;
    orgName: string;
    chatKey: string;
    send: (text: string) => Promise<void>;
    sendPdf?: (filename: string, data: Buffer) => Promise<void>;
    typing?: () => Promise<void>;
    appUrl?: string;
}

const HELP = "Я Айрис. Пишите (или наговаривайте голосовым) что сделать в CRM: «открой последний счёт», «подтверди все заказы», «пришли отчёт по складу на почту». Можно сразу несколько задач в одном сообщении — выполню по очереди и отвечу по каждой.\n\n/reset — начать разговор заново\n/help — эта подсказка";

function formatResult(r: ChatResult, appUrl: string): string {
    const lines: string[] = [r.reply];
    for (const e of r.executed ?? []) lines.push(e.state === "done" ? `✅ ${e.tool}${e.target ? `: ${e.target}` : ""}` : `⚠️ ${e.tool}: ${e.message ?? "не вышло"}`);
    if (r.nav && appUrl) lines.push(`🔗 ${appUrl}/ua${r.nav.link}`);
    return lines.filter(Boolean).join("\n");
}

async function runPending(deps: ControlDeps, pending: PendingAction[]) {
    const tools = allowedTools(deps.ctx);
    const out: string[] = [];
    for (const a of pending) {
        const tool = tools.find((t) => t.write && t.def.name === a.tool);
        if (!tool) { out.push(`⚠️ ${a.tool}: недоступно`); continue; }
        try {
            const args = tool.check ? tool.check(a.args) : a.args;
            await tool.run(deps.ctx, args);
            await log(deps.ctx, "executed", tool.def.name, args, "telegram");
            out.push(`✅ ${a.tool}${a.target ? `: ${a.target}` : ""}`);
        } catch (e) {
            await log(deps.ctx, "failed", tool.def.name, a.args, e instanceof Error ? e.message : "");
            out.push(`⚠️ ${a.tool}: ${e instanceof ToolError ? e.message : "не вышло"}`);
        }
    }
    await deps.send(out.join("\n"));
}

async function deliver(deps: ControlDeps, r: ChatResult, chat: Chat) {
    await deps.send(formatResult(r, deps.appUrl ?? ""));
    // PDF счёта приходит прямо в чат
    if (r.download && r.download.kind === "invoices" && deps.sendPdf) {
        try {
            const inv = await findInvoice(deps.ctx.org, r.download.id);
            await deps.sendPdf(`${inv.number}.pdf`, await invoicePdfBuffer(deps.ctx.org, inv, pdfLocale("ua")));
        } catch { /* PDF — удобство; сам ответ уже ушёл */ }
    } else if (r.download && deps.sendPdf) await deps.send(`📄 ${r.download.number}: PDF откройте в CRM (Бухгалтерия).`);
    if (r.actions.length) {
        chat.pending = r.actions;
        await deps.send(`Нужно ваше подтверждение:\n${r.actions.map((a) => `• ${a.tool}${a.target ? `: ${a.target}` : ""}`).join("\n")}\n\nОтветьте «да» — выполню, «нет» — отменю.`);
    }
}

/** Одно сообщение человека боту: команда, подтверждение, обычная просьба или очередь задач. */
export async function handleControlText(deps: ControlDeps, textRaw: string): Promise<void> {
    const text = textRaw.trim();
    if (!text) return;
    const chat = chatState(deps.chatKey);
    if (/^\/(start|help)\b/i.test(text)) return deps.send(HELP);
    if (/^\/reset\b/i.test(text)) { chat.history = []; chat.pending = []; return deps.send("Начала разговор заново."); }

    if (chat.pending.length && isYes(text)) { const p = chat.pending; chat.pending = []; return runPending(deps, p); }
    if (chat.pending.length && isNo(text)) { chat.pending = []; return deps.send("Отменила."); }
    chat.pending = [];

    if (chat.busy) return deps.send("Ещё занята предыдущей просьбой — отвечу, как закончу.");
    chat.busy = true;
    const typing = deps.typing ? setInterval(() => { void deps.typing?.().catch(() => undefined); }, 4000) : null;
    try {
        if (!(await takeQuota(deps.ctx.org, await dailyLimit(deps.ctx.org)))) return await deps.send("Дневной лимит запросов к Айрис по тарифу исчерпан. Он обновится завтра.");
        void deps.typing?.().catch(() => undefined);
        const history = [...chat.history.slice(-8), { role: "user" as const, text }];
        const opts = { history, locale: langOf(text) === "uk" ? "ua" : langOf(text) === "de" ? "de" : langOf(text) === "en" ? "en" : "ua", page: "telegram", orgName: deps.orgName, auto: true };
        const result = await runChat(deps.ctx, opts);
        if (result.queue) {
            await deps.send(result.reply);
            await runTasks(deps.ctx, opts, result.queue, async (r) => { await deps.send(`${r.index + 1}/${result.queue!.length} — ${formatResult(r, deps.appUrl ?? "")}`); if (r.actions.length) chat.pending.push(...r.actions); });
            if (chat.pending.length) await deps.send(`Ждут подтверждения:\n${chat.pending.map((a) => `• ${a.tool}${a.target ? `: ${a.target}` : ""}`).join("\n")}\n\nОтветьте «да» — выполню всё, «нет» — отменю.`);
            chat.history = [...history, { role: "assistant" as const, text: `Выполнено задач: ${result.queue.length}` }].slice(-10);
            return;
        }
        await deliver(deps, result, chat);
        chat.history = [...history, { role: "assistant" as const, text: result.reply }].slice(-10);
    } catch (e) {
        await deps.send(`⚠️ Не получилось: ${e instanceof Error && e.message ? e.message.slice(0, 200) : "ошибка"}`);
    } finally {
        if (typing) clearInterval(typing);
        chat.busy = false;
    }
}

// ── опрос Telegram ──
const offsets = new Map<string, number>();
const started = (globalThis as { __irisTgStarted?: boolean });

async function voiceToText(token: string, fileId: string, mime: string): Promise<string> {
    const file = await tg<{ file_path: string }>(token, "getFile", { file_id: fileId });
    const res = await fetchProvider(`${base()}/file/bot${token}/${file.file_path}`, { method: "GET" }, 30000);
    const bytes = Buffer.from(await res.arrayBuffer());
    return transcribeAudio(bytes, mime || "audio/ogg");
}

export async function pollOrg(orgId: string, _notify?: Record<string, any>) {
    const bot = await irisBot(orgId);
    if (!bot.enabled || !bot.botToken || !bot.chatId) return;
    const allowedChat = String(bot.chatId);
    const known = offsets.get(orgId) ?? bot.offset;
    const updates = await tg<TgUpdate[]>(bot.botToken, "getUpdates", { offset: known || undefined, limit: 20, timeout: 0, allowed_updates: ["message"] });
    if (!updates.length) return;
    // Запоминаем позицию ДО выполнения: после перезапуска старые команды не должны выполниться повторно
    const next = Math.max(...updates.map((u) => u.update_id)) + 1;
    offsets.set(orgId, next);
    await setIrisBot(orgId, { offset: next }).catch(() => undefined);

    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } });
    const userId = bot.controlUser;
    const member = userId ? await prisma.membership.findFirst({ where: { org: orgId, user: userId } }) : null;
    const now = new Date();
    for (const u of updates) {
        const m = u.message;
        if (!m || m.chat.type !== "private") continue;
        const send = async (text: string) => { for (const part of chunkText(text)) await tg(bot.botToken, "sendMessage", { chat_id: m.chat.id, text: part, disable_web_page_preview: true }); };
        if (String(m.chat.id) !== allowedChat) {
            // чужой чат: ничего не выполняем и не раскрываем, что за бот
            await send("Этот бот привязан к другому чату.").catch(() => undefined);
            continue;
        }
        if (Date.now() / 1000 - m.date > 600) continue; // сообщение старше 10 минут (бот был выключен) — не выполняем вдогонку
        if (!member) { await send("Бот Айрис не настроен до конца: подключите его в CRM, Настройки → Интеграции → «Бот Айрис».").catch(() => undefined); continue; }
        const ctx: AiCtx = { org: orgId, userId: member.user, role: member.role as AiCtx["role"], modules: (member.modules ?? []) as string[], today: now.toISOString().slice(0, 10), now: now.toISOString().slice(0, 16) };
        const deps: ControlDeps = {
            ctx, orgName: org?.name ?? "", chatKey: `${orgId}:${m.chat.id}`, send,
            typing: () => tg(bot.botToken, "sendChatAction", { chat_id: m.chat.id, action: "typing" }).then(() => undefined),
            sendPdf: async (filename, data) => {
                const form = new FormData();
                form.append("chat_id", String(m.chat.id));
                form.append("document", new Blob([new Uint8Array(data)], { type: "application/pdf" }), filename);
                await fetchProvider(`${base()}/bot${bot.botToken}/sendDocument`, { method: "POST", body: form }, 60000);
            },
            appUrl: (process.env.APP_URL || "").replace(/\/+$/, ""),
        };
        try {
            let text = m.text ?? "";
            const voice = m.voice ?? m.audio;
            if (!text && voice) {
                try { text = await voiceToText(bot.botToken, voice.file_id, voice.mime_type ?? "audio/ogg"); } catch { text = ""; }
                if (!text) { await send("Не смогла разобрать голосовое — попробуйте ещё раз или напишите текстом."); continue; }
                await send(`🎤 ${text}`);
            }
            await handleControlText(deps, text);
        } catch (e) {
            await send(`⚠️ ${e instanceof Error ? e.message.slice(0, 200) : "ошибка"}`).catch(() => undefined);
        }
    }
}

let busyLoop = false;
async function tick() {
    if (busyLoop) return;
    busyLoop = true;
    try {
        const orgs = await prisma.organization.findMany({ where: { notify: { path: ["iris", "enabled"], equals: true } }, select: { id: true, notify: true } });
        for (const o of orgs) {
            try { await pollOrg(o.id, (o.notify ?? {}) as Record<string, any>); } catch (e) { if (process.env.NODE_ENV !== "production") console.error("telegram control:", e instanceof Error ? e.message : e); }
        }
    } catch { /* база недоступна — следующий круг */ } finally { busyLoop = false; }
}

/** Запускает опрос один раз на процесс (instrumentation.ts; запасной запуск — из cron). */
export function startTelegramControl() {
    if (started.__irisTgStarted || process.env.TELEGRAM_CONTROL === "0") return false;
    started.__irisTgStarted = true;
    const timer = setInterval(() => { void tick(); }, 3000);
    timer.unref?.();
    return true;
}
