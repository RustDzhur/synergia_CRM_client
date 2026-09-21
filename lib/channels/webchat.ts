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
