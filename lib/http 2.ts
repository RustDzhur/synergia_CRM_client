// Ошибка внешнего провайдера: message показываем пользователю как есть
export class ProviderError extends Error {}

// fetch с таймаутом: внешний сервис не должен подвесить serverless-функцию
export async function fetchProvider(url: string, init: RequestInit = {}, ms = 10000) {
    try {
        return await fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
    } catch {
        throw new ProviderError("The provider did not respond. Check the connection and try again.");
    }
}
