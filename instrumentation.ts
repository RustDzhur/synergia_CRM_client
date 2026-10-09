// Запускается один раз при старте сервера Next (собственный сервер/Docker). Здесь поднимается опрос Telegram для
// управления Айрис из чата (lib/ai/telegramBot.ts); при сборке он не нужен.
// Импорт — строго внутри проверки NEXT_RUNTIME === "nodejs": так webpack выбрасывает ветку из сборки для edge-среды,
// куда Node-модули (почта, потоки) не входят и сборка иначе падает.
export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        await import("./instrumentation.node");
    }
}
