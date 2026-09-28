// Публичный API онлайн-чата вызывается со сторонних сайтов (виджет на сайте клиента), поэтому нужен CORS.
// Права посетителя — только читать и писать в свою беседу, id которой (visitor) знает только его браузер.
export const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
};

export const corsJson = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });
export const corsPreflight = () => new Response(null, { status: 204, headers: CORS });
export const validVisitor = (v: unknown): v is string => typeof v === "string" && /^[a-zA-Z0-9]{16,64}$/.test(v);

// Контакт посетителя: почта или телефон. Ищем по нему контакт в CRM, поэтому проверяем форму —
// всё остальное (адреса сайтов, случайный текст) контактом не считается.
export function contactValue(v: unknown): string {
    if (typeof v !== "string") return "";
    const value = v.trim().slice(0, 120);
    if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(value)) return value;
    if (/^\+?[\d\s()-]{7,20}$/.test(value)) return value.replace(/[^\d+]/g, "");
    return "";
}
