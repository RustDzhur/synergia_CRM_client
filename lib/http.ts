// Ошибка внешнего провайдера: message показываем пользователю как есть
export class ProviderError extends Error {}

// fetch с таймаутом: внешний сервис не должен подвесить serverless-функцию.
// Причину неудачи показываем рядом с человеческой фразой: «провайдер не ответил» одинаково выглядит
// при опечатке в адресе, недоступной из сервера сети и простом таймауте, а чинятся они по-разному.
export async function fetchProvider(url: string, init: RequestInit = {}, ms = 10000) {
    try {
        return await fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
    } catch (e) {
        const timedOut = e instanceof Error && (e.name === "TimeoutError" || /abort/i.test(e.message));
        const reason = timedOut
            ? `no answer within ${Math.round(ms / 1000)}s`
            : e instanceof Error && e.cause instanceof Error
              ? e.cause.message
              : e instanceof Error
                ? e.message
                : "";
        throw new ProviderError(`The provider did not respond. Check the connection and try again.${reason ? ` (${reason.slice(0, 160)})` : ""}`);
    }
}
