import { prisma } from "@/lib/prisma";
import { marketOf } from "@/lib/finance/market";
import { connectIntegration, checkIntegration } from "@/lib/channels/connect";
import { connectableNow, describeManifest, forMarket, getManifest, listManifests, type ManifestView } from "./manifests";

export class IntegrationFlowError extends Error {
    constructor(message: string, public status = 400) { super(message); }
}

/** Убирает из текста ошибки провайдера значения, которые ввёл человек: в ответ и в журнал секреты не попадают. */
export function scrub(message: string, values: string[]): string {
    let out = message;
    for (const v of values) if (v && v.length >= 4) out = out.split(v).join("•••");
    return out.slice(0, 300);
}

export async function marketOfOrg(org: string): Promise<string | null> {
    const s = await prisma.financeSettings.findUnique({ where: { org }, select: { country: true } });
    return marketOf(s?.country);
}

export interface CatalogEntry extends ManifestView { connected: boolean; connectedStatus?: string }

/** Паспорта, подходящие рынку фирмы, с признаком «уже подключено». Планируемые возвращаются (для честного «пока нет»), но connectable=false. */
export async function catalogFor(org: string, locale: string, query = ""): Promise<CatalogEntry[]> {
    const [market, all, mine] = await Promise.all([marketOfOrg(org), listManifests(), prisma.integration.findMany({ where: { owner: org }, select: { type: true, status: true } })]);
    // запрос на естественном языке: подходит, если совпало любое слово (без окончания «s»); ничего не совпало — отдаём всё для рынка
    const words = query.toLowerCase().split(/[^\p{L}\p{N}]+/u).map((w) => w.replace(/s$/, "")).filter((w) => w.length >= 3);
    const hay = (m: ManifestView) => `${m.key} ${m.title} ${m.kind} ${m.description}`.toLowerCase();
    const narrowed = words.length ? all.filter((m) => forMarket(m, market)).map((m) => describeManifest(m, locale)).filter((m) => words.some((w) => hay(m).includes(w))) : [];
    const pool = narrowed.length ? narrowed : all.filter((m) => forMarket(m, market)).map((m) => describeManifest(m, locale));
    return pool
        .map((m) => { const c = mine.find((i) => i.type === m.key); return { ...m, connected: !!c && c.status === "connected", connectedStatus: c?.status }; });
}

/** Защищённое подключение: ключи приходят сюда напрямую из формы, не из чата. Наружу — только имя и состояние. */
export async function connectWithSecrets(org: string, type: string, fields: Record<string, unknown>, origin: string) {
    const mf = await getManifest(type);
    if (!mf) throw new IntegrationFlowError("Unknown integration", 404);
    if (mf.status === "planned") throw new IntegrationFlowError("This integration is not available yet", 409);
    if (!connectableNow(mf)) throw new IntegrationFlowError("This integration needs no keys", 409);
    const clean: Record<string, string> = {};
    for (const fd of mf.fields) {
        const v = fields[fd.key];
        if (typeof v === "string" && v.trim()) clean[fd.key] = v.trim();
        else if (fd.required) throw new IntegrationFlowError(`Field ${fd.key} is required`);
    }
    const secrets = mf.fields.filter((x) => x.secret).map((x) => clean[x.key]).filter(Boolean);
    try {
        const { doc, warning } = await connectIntegration(org, type, clean, origin);
        return { id: String(doc.id), type, name: String(doc.name ?? ""), status: String(doc.status), warning: warning ? scrub(warning, Object.values(clean)) : "" };
    } catch (e) {
        // собственные тексты кода подключения безопасны; ответ провайдера может содержать ключ — вычищаем все введённые значения
        const err = e as { status?: number; message?: string };
        throw new IntegrationFlowError(scrub(err.message ?? "Connection failed", [...secrets, ...Object.values(clean)]), err.status && err.status >= 400 && err.status < 600 ? err.status : 400);
    }
}

/** Проверка подключённой интеграции (запрос к провайдеру) без изменений данных, кроме отметки состояния. */
export async function verifyConnected(org: string, type: string, origin: string) {
    const doc = await prisma.integration.findFirst({ where: { owner: org, type } });
    if (!doc) throw new IntegrationFlowError("Not connected yet", 404);
    // Payme и Click сами вызывают наш адрес: проверить ключи запросом нельзя, но видно, дошёл ли до нас хоть один запрос провайдера
    if (type === "payme" || type === "click") {
        const n = await prisma.uzPayTx.count({ where: { org, provider: type } });
        return { ok: n > 0, checked: false, message: n > 0 ? "" : "No requests from the provider yet. Paste the callback address into the provider's cabinet and run its sandbox test." };
    }
    try {
        await checkIntegration(doc, origin);
    } catch (e) {
        return { ok: false, message: scrub((e as Error).message ?? "Check failed", []) };
    }
    const fresh = await prisma.integration.findUnique({ where: { id: doc.id } });
    // глубокая проверка есть только у Telegram (вебхук) и WhatsApp (доступ к номеру); остальные проверены запросом к провайдеру при подключении
    return { ok: fresh?.status === "connected", checked: type === "telegram" || type === "whatsapp", message: fresh?.status === "connected" ? "" : scrub(fresh?.error ?? "Check failed", []) };
}
