import { startTelegramControl } from "./lib/ai/telegramBot";

// Только Node-среда (см. instrumentation.ts). Сбой не должен ронять сайт — поэтому try/catch.
try {
    if (process.env.NEXT_PHASE !== "phase-production-build") startTelegramControl();
} catch (e) {
    console.error("telegram control did not start:", e instanceof Error ? e.message : e);
}
