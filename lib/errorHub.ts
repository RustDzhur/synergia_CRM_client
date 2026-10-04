import { sendTelegram } from "@/lib/channels/telegram";
import { secretsOf } from "@/lib/integrations";
import { errorBot } from "@/lib/platformSettings";
import { prisma } from "@/lib/prisma";

// Единая точка приёма ошибок платформы. Сюда сходится всё: браузер (исключения, отказавшие промисы, console.error, упавшие запросы,
// не загрузившиеся файлы, поломки отрисовки), сервер (исключения процесса, console.error, ответы 5xx), база данных (недоступна, взаимная
// блокировка, неверные запросы), контейнеры (строки ERROR/FATAL в журналах postgres, caddy, omniroute…, перезапуски) и cron.
// Для каждой ошибки владельцу в Telegram уходит не «сырой» текст, а объяснение человеческим языком: что это, вероятная причина, что проверить.
//
// Чтобы чат не заваливало: одинаковые ошибки (по «отпечатку» — текст без чисел и идентификаторов + верхняя строка стека) шлются сразу в первый
// раз, потом не чаще раза в 10 минут с числом повторов; всего не больше 40 сообщений в час, остальное сворачивается в одну сводку.
// Хранится в памяти процесса и (для журнала в админке) в SectionRecord("platform", "errors:log"). Модуль никогда не бросает исключений.

export type ErrorSource = "browser" | "server" | "database" | "container" | "cron" | "external";

export interface ErrorEvent {
    source: ErrorSource;
    /** подвид: "исключение", "console.error", "запрос 500", "контейнер postgres" … */
    kind?: string;
    message: string;
    stack?: string;
    /** что делали / в каком маршруте */
    where?: string;
    url?: string;
    org?: string;
    user?: string;
    detail?: Record<string, unknown>;
}

interface Entry { fingerprint: string; first: number; lastSent: number; count: number; unsent: number }
interface Hub { entries: Map<string, Entry>; sentAt: number[]; suppressed: number; aiAt: number[]; busy: number; ring: JournalItem[]; inserts: number; target?: { value: { botToken: string; chatId: string } | null; at: number } }
export interface JournalItem { at: string; source: ErrorSource; kind: string; title: string; explanation: string; where: string; count: number }

const g = globalThis as { __errorHub?: Hub };
const hub: Hub = (g.__errorHub ??= { entries: new Map(), sentAt: [], suppressed: 0, aiAt: [], busy: 0, ring: [], inserts: 0 } as Hub);

const REPEAT_MS = 10 * 60_000;
const HOUR = 3_600_000;
const MAX_PER_HOUR = 40;
const MAX_AI_PER_HOUR = 30;
const MAX_LENGTH = 3800;

// Шум, который ничего не говорит о поломке сайта: расширения браузера, служебные предупреждения, отмены запросов при уходе со страницы
const IGNORE = [
    /ResizeObserver loop/i,
    /Non-Error promise rejection captured/i,
    /chrome-extension:|moz-extension:|safari-extension:/i,
    /^Script error\.?$/i,
    /AbortError|The user aborted a request|The operation was aborted/i,
    /\[errorHub\]/,
    /Load failed$|NetworkError when attempting to fetch resource\.?$|Failed to fetch$/i, // обрыв связи у посетителя в момент ухода со страницы
    /Minified React error #4(18|23|25)/, // гидратация: чаще из-за расширений браузера, сами по себе не поломка
    /googletagmanager|google-analytics|doubleclick/i,
];

const SOURCE_TITLE: Record<ErrorSource, string> = {
    browser: "🌐 Браузер",
    server: "🖥 Сервер",
    database: "🗄 База данных",
    container: "🐳 Контейнер",
    cron: "⏱ Задача по расписанию",
    external: "🔌 Внешний сервис",
};

const topFrame = (stack = "") => {
    const line = stack.split("\n").map((l) => l.trim()).find((l) => /^at\s|@|\(.*:\d+:\d+\)/.test(l)) ?? "";
    return line.replace(/:\d+:\d+/g, "").replace(/\?[^\s)]*/g, "").slice(0, 120);
};

export function fingerprintOf(ev: ErrorEvent): string {
    const msg = ev.message
        .replace(/[0-9a-f]{8,}(-[0-9a-f]{4}){0,4}/gi, "#") // идентификаторы, хеши, uuid
        .replace(/\d+/g, "#")
        .replace(/\s+/g, " ")
        .slice(0, 160);
    return `${ev.source}|${ev.kind ?? ""}|${msg}|${topFrame(ev.stack)}`;
}

// ── объяснения без модели: самые частые случаи ────────────────────────────────────────────────────────

interface Explanation { what: string; cause: string; check: string }

const KNOWN: Array<[RegExp, Explanation]> = [
    [/ENOSPC|no space left on device/i, { what: "На диске сервера закончилось место.", cause: "Журналы, образы Docker или файлы заполнили диск; база и сайт перестают писать данные.", check: "df -h на сервере; docker system df; очистить образы/кэш (docker builder prune, docker image prune)." }],
    [/out of memory|OOM|Cannot allocate memory|heap out of memory/i, { what: "Процессу не хватило оперативной памяти.", cause: "Тяжёлый запрос, утечка памяти или слишком много параллельных задач.", check: "free -m и docker stats на сервере; перезапуск контейнера; посмотреть, какой запрос предшествовал сбою." }],
    [/ECONNREFUSED|connect ECONN|Can't reach database server|P1001|P1002|Connection terminated|the database system is (starting up|shutting down)/i, { what: "Не удалось подключиться к базе данных или сервису.", cause: "Контейнер postgres (или другой сервис) остановлен, перезапускается или перегружен.", check: "docker ps и docker logs postgres; проверить свободное место и память на сервере." }],
    [/too many clients|sorry, too many|P2024|Timed out fetching a new connection|connection pool/i, { what: "Закончились подключения к базе данных.", cause: "Слишком много одновременных запросов или соединения не закрываются.", check: "Число соединений в postgres (pg_stat_activity); при необходимости увеличить лимит или перезапустить сайт." }],
    [/deadlock detected|P2034/i, { what: "Две операции в базе заблокировали друг друга (deadlock).", cause: "Два запроса одновременно меняют одни и те же строки в разном порядке.", check: "Обычно повтор помогает; если повторяется — искать операции, которые обновляют одни записи." }],
    [/P2002|Unique constraint failed/i, { what: "Попытка создать запись, которая уже есть (дубликат).", cause: "Повторное нажатие кнопки или одновременные запросы; в коде нет проверки на дубль.", check: "Найти место создания записи по стеку и добавить проверку или upsert." }],
    [/P2003|Foreign key constraint/i, { what: "Запись ссылается на то, чего уже нет.", cause: "Связанная запись удалена или передан неверный идентификатор.", check: "Проверить, какой идентификатор пришёл в запросе." }],
    [/PrismaClientValidationError|Unknown argument|Argument .* is missing/i, { what: "Запрос к базе составлен неверно — это ошибка в коде.", cause: "В запрос передано поле, которого нет в схеме, или не передано обязательное.", check: "Открыть место из стека и сравнить с prisma/schema.prisma." }],
    [/does not exist in the current database|relation .* does not exist|column .* does not exist|P2021|P2022/i, { what: "В базе нет нужной таблицы или колонки.", cause: "Схема базы не совпадает с кодом: после обновления не применили изменение схемы.", check: "Сравнить prisma/schema.prisma с базой; применить prisma db push вручную (автоматически он не запускается)." }],
    [/ChunkLoadError|Loading chunk .* failed|Failed to load chunk|error loading dynamically imported module/i, { what: "У посетителя открыта устаревшая версия сайта: файлы страницы заменились при обновлении.", cause: "Сайт выкладывался, пока вкладка была открыта.", check: "Обычно достаточно обновить страницу; если повторяется у всех — проверить, что выкладка завершилась." }],
    [/Hydration failed|Text content does not match|There was an error while hydrating/i, { what: "Страница при загрузке отрисовалась иначе, чем пришла с сервера.", cause: "Содержимое зависит от времени, языка или браузера и различается на сервере и в браузере.", check: "Найти компонент по стеку: даты, Math.random, localStorage в первой отрисовке." }],
    [/JWT|jwt (expired|malformed)|invalid signature|TokenExpired/i, { what: "Проблема с токеном входа.", cause: "Сессия истекла или токен повреждён; при смене JWT_SECRET все входы сбрасываются.", check: "Если массово — не менялся ли JWT_SECRET; одиночно — достаточно войти заново." }],
    [/429|Too Many Requests|rate limit/i, { what: "Внешний сервис отказал: слишком много запросов.", cause: "Превышен лимит запросов к стороннему API или к нашему.", check: "Посмотреть, что вызывает всплеск запросов; при необходимости снизить частоту." }],
    [/ETIMEDOUT|timed out|timeout|ESOCKETTIMEDOUT|UND_ERR/i, { what: "Запрос не дождался ответа.", cause: "Внешний сервис или внутренний контейнер отвечает слишком медленно или недоступен.", check: "Проверить доступность сервиса (omniroute, почтовый провайдер, Telegram) и нагрузку на сервер." }],
    [/ENOTFOUND|EAI_AGAIN|getaddrinfo/i, { what: "Не удалось найти адрес сервера (DNS).", cause: "Нет интернета у сервера или неверный адрес сервиса.", check: "ping/curl с сервера до этого адреса; проверить DNS и адрес в настройках." }],
    [/Cannot read propert(y|ies) of (undefined|null)|undefined is not an object|null is not an object|is not a function|is not defined/i, { what: "Ошибка в коде: программа обратилась к данным, которых нет.", cause: "Ответ пришёл не в ожидаемом виде или данные ещё не загрузились.", check: "Открыть файл и строку из стека; добавить проверку на пустое значение." }],
    [/\b50[0-4]\b|Internal Server Error/i, { what: "Сервер ответил ошибкой на запрос.", cause: "Необработанное исключение в обработчике или недоступна база/сервис.", check: "Найти соседнее сообщение «Сервер» с тем же адресом — там причина и стек." }],
];

export function quickExplain(ev: ErrorEvent): Explanation | null {
    const haystack = `${ev.message}\n${ev.stack ?? ""}`;
    for (const [re, ex] of KNOWN) if (re.test(haystack)) return ex;
    return null;
}

async function aiExplain(ev: ErrorEvent): Promise<Explanation | null> {
    try {
        const now = Date.now();
        hub.aiAt = hub.aiAt.filter((t) => now - t < HOUR);
        if (hub.aiAt.length >= MAX_AI_PER_HOUR) return null;
        const { aiConfigured, complete } = await import("@/lib/ai/provider");
        if (!aiConfigured()) return null;
        hub.aiAt.push(now);
        const system = `Ты помогаешь владельцу небольшой CRM-платформы Firmspace (Next.js 13, Prisma + PostgreSQL, Docker на домашнем сервере, Caddy, контейнеры: firmspace-crm, postgres, redis, minio, omniroute, tts, speaches, dsh/Harness). Тебе дают техническую ошибку. Ответь по-русски простыми словами, строго тремя строками, без markdown:
Что это: …
Причина: …
Что проверить: …
Если не уверен — пиши «вероятно». Ничего не выдумывай про код, которого не видишь.`;
        const prompt = `Источник: ${SOURCE_TITLE[ev.source]}${ev.kind ? ` / ${ev.kind}` : ""}\nГде: ${ev.where ?? ev.url ?? "—"}\nСообщение: ${ev.message.slice(0, 600)}\nСтек:\n${(ev.stack ?? "").split("\n").slice(0, 7).join("\n")}\n${ev.detail ? `Детали: ${JSON.stringify(ev.detail).slice(0, 500)}` : ""}`;
        const reply = await Promise.race([
            complete(system, [{ role: "user", text: prompt }], []),
            new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 15_000)),
        ]);
        const text = reply.text.trim();
        const pick = (label: string) => (text.match(new RegExp(`${label}\\s*:?\\s*(.+)`, "i"))?.[1] ?? "").trim();
        const what = pick("Что это"), cause = pick("Причина"), check = pick("Что проверить");
        return what ? { what, cause: cause || "не удалось определить", check: check || "—" } : text ? { what: text.slice(0, 400), cause: "", check: "" } : null;
    } catch {
        return null;
    }
}

// ── отправка ──────────────────────────────────────────────────────────────────────────────────────────

/** Куда отправить: бот отчётов платформы, иначе бот фирмы с привязанным чатом. Адрес запоминается на 10 минут: когда база недоступна
 *  (а это как раз то, о чём надо сообщить), прежний адрес чата берётся из памяти. */
async function targetChat(org?: string): Promise<{ botToken: string; chatId: string } | null> {
    const cached = hub.target;
    if (cached && cached.value && Date.now() - cached.at < 10 * 60_000) return cached.value;
    const fresh = await findTarget(org);
    if (fresh) hub.target = { value: fresh, at: Date.now() };
    return fresh ?? cached?.value ?? null;
}

async function findTarget(org?: string): Promise<{ botToken: string; chatId: string } | null> {
    const dedicated = await errorBot();
    if (dedicated.botToken && dedicated.chatId) return { botToken: dedicated.botToken, chatId: dedicated.chatId };
    const docs = await prisma.integration.findMany({ where: { type: "telegram", ...(org ? { owner: org } : {}) } }).catch(() => []);
    const doc = docs.find((d) => String((d.config as { errorChatId?: unknown } | null)?.errorChatId ?? "") !== "") ?? null;
    if (!doc) return null;
    const botToken = String(secretsOf<{ botToken?: string }>(doc).botToken ?? "");
    const chatId = String((doc.config as { errorChatId?: unknown }).errorChatId ?? "");
    return botToken && chatId ? { botToken, chatId } : null;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function formatMessage(ev: ErrorEvent, ex: Explanation | null, count: number, suppressed: number): string {
    const title = `🔴 ${SOURCE_TITLE[ev.source]}${ev.kind ? ` · ${ev.kind}` : ""}`;
    const stack = (ev.stack ?? "").split("\n").slice(0, 5).map((l) => l.trim()).filter(Boolean).join("\n");
    const detail = ev.detail
        ? Object.entries(ev.detail).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`).join("\n")
        : "";
    return clip(
        [
            title,
            clip(ev.message, 500),
            ex ? `\nЧто это: ${ex.what}${ex.cause ? `\nПричина: ${ex.cause}` : ""}${ex.check ? `\nЧто проверить: ${ex.check}` : ""}` : "",
            [ev.where ? `\nГде: ${ev.where}` : "", ev.url ? `Адрес: ${clip(ev.url, 200)}` : "", ev.org ? `Фирма: ${ev.org}` : "", ev.user ? `Пользователь: ${ev.user}` : ""].filter(Boolean).join("\n"),
            detail ? `\n${clip(detail, 700)}` : "",
            stack ? `\nТехнически:\n${clip(stack, 900)}` : "",
            count > 1 ? `\nПовторилась ${count} раз(а) с прошлого сообщения.` : "",
            suppressed ? `\n(Ещё ${suppressed} сообщений за последний час свёрнуто, чтобы не засорять чат.)` : "",
            `\n${new Date().toISOString().replace("T", " ").slice(0, 19)} UTC`,
        ].filter(Boolean).join("\n"),
        MAX_LENGTH
    );
}

function remember(ev: ErrorEvent, ex: Explanation | null, count: number) {
    const item: JournalItem = { at: new Date().toISOString(), source: ev.source, kind: ev.kind ?? "", title: clip(ev.message, 200), explanation: ex ? ex.what : "", where: ev.where ?? ev.url ?? "", count };
    hub.ring.unshift(item);
    hub.ring.length = Math.min(hub.ring.length, 60);
    // журнал для админки переживает перезапуск: пишем в базу, не мешая отправке
    void (async () => {
        try {
            await prisma.sectionRecord.create({ data: { org: "platform", key: "errors:log", rid: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, values: item as unknown as never } });
            if (++hub.inserts % 50 === 0) {
                const old = await prisma.sectionRecord.findMany({ where: { org: "platform", key: "errors:log" }, orderBy: { createdAt: "desc" }, skip: 300, take: 200, select: { id: true } });
                if (old.length) await prisma.sectionRecord.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
            }
        } catch { /* журнал необязателен */ }
    })();
}

/** Последние ошибки для журнала в админке: из базы (переживает перезапуск), иначе из памяти. */
export async function recentErrors(limit = 40): Promise<JournalItem[]> {
    try {
        const rows = await prisma.sectionRecord.findMany({ where: { org: "platform", key: "errors:log" }, orderBy: { createdAt: "desc" }, take: limit });
        if (rows.length) return rows.map((r) => r.values as unknown as JournalItem);
    } catch { /* база может быть той самой причиной */ }
    return hub.ring.slice(0, limit);
}

/** Принять ошибку. Возвращает true, если сообщение ушло в Telegram. Не бросает исключений. */
export async function ingest(ev: ErrorEvent): Promise<boolean> {
    // Ошибки базы, возникшие, пока сам отчёт ходит в базу (за адресом чата или журналом), — это эхо, а не новая поломка: иначе недоступная
    // база порождала бы бесконечную цепочку отчётов об отчётах
    if (ev.source === "database" && hub.busy > 0) return false;
    hub.busy++;
    try {
        const message = String(ev.message ?? "").trim();
        if (!message || IGNORE.some((re) => re.test(message) || re.test(ev.stack ?? ""))) return false;
        const now = Date.now();
        const fp = fingerprintOf({ ...ev, message });
        const entry = hub.entries.get(fp);
        if (entry) {
            entry.count++;
            entry.unsent++;
            if (now - entry.lastSent < REPEAT_MS) return false; // уже сообщали недавно — только считаем повторы
        }
        if (hub.entries.size > 500) hub.entries.clear();

        // общий потолок сообщений в час
        hub.sentAt = hub.sentAt.filter((t) => now - t < HOUR);
        if (hub.sentAt.length >= MAX_PER_HOUR) { hub.suppressed++; return false; }

        const target = await targetChat(ev.org);
        if (!target) return false;

        const repeats = entry ? entry.unsent : 1;
        const ex = quickExplain({ ...ev, message }) ?? (await aiExplain({ ...ev, message }));
        const text = formatMessage({ ...ev, message }, ex, repeats, hub.suppressed);
        await sendTelegram(target.botToken, target.chatId, text);

        hub.suppressed = 0;
        hub.sentAt.push(now);
        hub.entries.set(fp, { fingerprint: fp, first: entry?.first ?? now, lastSent: now, count: (entry?.count ?? 0) || 1, unsent: 0 });
        remember({ ...ev, message }, ex, repeats);
        return true;
    } catch {
        return false; // отчёт об ошибке сам не должен её создавать
    } finally {
        hub.busy--;
    }
}

/** Сообщить об ошибке из кода сервера: удобная обёртка с автоопределением «что случилось» по объекту ошибки. */
export function errorToEvent(error: unknown, base: Omit<ErrorEvent, "message" | "stack">): ErrorEvent {
    if (error instanceof Error) return { ...base, message: `${error.name}: ${error.message}`, stack: error.stack };
    return { ...base, message: typeof error === "string" ? error : JSON.stringify(error)?.slice(0, 500) ?? String(error) };
}
