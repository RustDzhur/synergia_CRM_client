// Простейший ограничитель для публичных эндпоинтов (виджет чата). Счётчики живут в памяти
// одного экземпляра функции, поэтому это защита от случайного спама, а не строгий лимит.
const hits = new Map<string, number[]>();

export function rateLimited(key: string, limit: number, windowMs: number) {
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) hits.forEach((v, k) => { if (now - v[v.length - 1] > windowMs) hits.delete(k); });
    return recent.length > limit;
}
