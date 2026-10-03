// Запускается один раз при старте сервера Next (собственный сервер/Docker). Здесь поднимается опрос Telegram для
// управления Айрис из чата (lib/ai/telegramBot.ts); на Vercel и при сборке он не нужен. Сбой здесь не должен
// ронять сайт — поэтому всё в try/catch.
export async function register() {
    if (process.env.NEXT_RUNTIME !== "nodejs") return;
    if (process.env.NEXT_PHASE === "phase-production-build") return;
    try {
        const { startTelegramControl } = await import("./lib/ai/telegramBot");
        startTelegramControl();
    } catch (e) {
        console.error("telegram control did not start:", e instanceof Error ? e.message : e);
    }
}
