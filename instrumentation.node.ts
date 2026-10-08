import { startTelegramControl } from "./lib/ai/telegramBot";
import { ingest } from "./lib/errorHub";
import { startDemoSweeper } from "./lib/demo";
import { startRoutineScheduler } from "./lib/office/routines";

// Только Node-среда (см. instrumentation.ts). Сбой не должен ронять сайт — поэтому try/catch.
try {
    if (process.env.NEXT_PHASE !== "phase-production-build") startTelegramControl();
} catch (e) {
    console.error("telegram control did not start:", e instanceof Error ? e.message : e);
}

// Регулярные задачи роботов Робот-офиса (lib/office/routines.ts): раз в минуту проверяется, чья пора
try {
    if (process.env.NEXT_PHASE !== "phase-production-build") startRoutineScheduler();
} catch (e) {
    console.error("office scheduler did not start:", e instanceof Error ? e.message : e);
}

// Демо-кабинеты (lib/demo): копии, которые посетитель не закрыл выходом, стираются через несколько часов
try {
    if (process.env.NEXT_PHASE !== "phase-production-build") startDemoSweeper();
} catch (e) {
    console.error("demo sweeper did not start:", e instanceof Error ? e.message : e);
}

// Сторож ошибок сервера (отчёты — lib/errorHub.ts). Ловит то, что иначе остаётся только в журнале контейнера:
//  • исключения процесса, которые никто не поймал (uncaughtException) и отклонённые промисы (unhandledRejection);
//  • всё, что сервер сам пишет в console.error: сюда Next.js выводит необработанные исключения обработчиков маршрутов и страниц, сюда же
//    попадают сообщения Prisma и наших модулей.
// Одно и то же сообщение не уйдёт дважды подряд (отпечатки в errorHub), а собственные сбои отчёта (метка [errorHub]) игнорируются.
const g = globalThis as { __serverWatchOn?: boolean };
if (process.env.NEXT_PHASE !== "phase-production-build" && !g.__serverWatchOn) {
    g.__serverWatchOn = true;

    const textOf = (args: unknown[]) =>
        args.map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : typeof a === "string" ? a : (() => { try { return JSON.stringify(a); } catch { return String(a); } })())).join(" ").slice(0, 700);

    // Next 13.4: когда посетитель закрывает вкладку посреди потоковой отрисовки, React прерывает поток с причиной null, а обработчик
    // ошибок Next (create-error-handler) читает null.message и падает сам, затем пишет в журнал «null». Это шум обрыва соединения, а не ошибка кода.
    const isAbortNoise = (text: string, stack?: string) =>
        text.trim() === "null" || (/reading 'message'/.test(text) && /create-error-handler/.test(stack || text));

    process.on("uncaughtException", (e) => {
        void ingest({ source: "server", kind: "необработанное исключение процесса", message: e instanceof Error ? `${e.name}: ${e.message}` : String(e), stack: e instanceof Error ? e.stack : undefined, where: "процесс сайта" });
    });
    process.on("unhandledRejection", (reason) => {
        if (reason instanceof Error && isAbortNoise(`${reason.name}: ${reason.message}`, reason.stack)) return;
        void ingest({ source: "server", kind: "необработанный промис", message: reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason), stack: reason instanceof Error ? reason.stack : undefined, where: "процесс сайта" });
    });

    const nativeError = console.error.bind(console);
    let inside = false;
    console.error = (...args: unknown[]) => {
        nativeError(...args);
        if (inside) return;
        inside = true;
        try {
            const err = args.find((a) => a instanceof Error) as Error | undefined;
            const message = textOf(args);
            // сообщения самого отчёта и провайдера, о которых уже сообщает свой код, пропускаем: там отдельный отпечаток и объяснение
            if (message && !message.startsWith("[errorHub]") && !isAbortNoise(message, err?.stack)) {
                const db = /prisma|PrismaClient|P\d{4}\b/i.test(message);
                void ingest({ source: db ? "database" : "server", kind: db ? "сообщение Prisma" : "console.error", message, stack: err?.stack, where: db ? "обращение к базе" : "журнал сервера" });
            }
        } finally {
            inside = false;
        }
    };
}
