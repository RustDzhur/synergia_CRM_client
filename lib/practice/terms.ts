import { prisma } from "@/lib/prisma";
import { PracticeError } from "./service";

// Коммерческие значения «Практики» (docs/TZ_MASTER.md §5.4): стартовые, хранятся в PlatformSettings и меняются без деплоя.
// По умолчанию enforce = false: ограничения не включены, пока цены не установлены владельцем после интервью.

const KEY = "practiceTerms";
export interface PracticeTerms { freeClients: number; enforce: boolean; monthlyPrice: number | null; clientDiscountPct: number | null; currency: string }
export const DEFAULT_TERMS: PracticeTerms = { freeClients: 3, enforce: false, monthlyPrice: null, clientDiscountPct: null, currency: "EUR" };

export async function practiceTerms(): Promise<PracticeTerms> {
    const row = await prisma.platformSettings.findUnique({ where: { key: KEY } }).catch(() => null);
    if (!row?.value) return DEFAULT_TERMS;
    try { return { ...DEFAULT_TERMS, ...(JSON.parse(row.value) as Partial<PracticeTerms>) }; } catch { return DEFAULT_TERMS; }
}

export async function setPracticeTerms(input: Partial<Record<keyof PracticeTerms, unknown>>): Promise<PracticeTerms> {
    const cur = await practiceTerms();
    const num = (v: unknown, def: number | null, min: number, max: number) => (v === null ? null : typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def);
    const next: PracticeTerms = {
        freeClients: Math.round(num(input.freeClients, cur.freeClients, 0, 1000) ?? cur.freeClients),
        enforce: typeof input.enforce === "boolean" ? input.enforce : cur.enforce,
        monthlyPrice: input.monthlyPrice === undefined ? cur.monthlyPrice : num(input.monthlyPrice, cur.monthlyPrice, 0, 100000),
        clientDiscountPct: input.clientDiscountPct === undefined ? cur.clientDiscountPct : num(input.clientDiscountPct, cur.clientDiscountPct, 0, 100),
        currency: typeof input.currency === "string" && /^[A-Z]{3}$/.test(input.currency) ? input.currency : cur.currency,
    };
    await prisma.platformSettings.upsert({ where: { key: KEY }, create: { key: KEY, value: JSON.stringify(next) }, update: { value: JSON.stringify(next) } });
    return next;
}

/** Можно ли практике добавить ещё одного клиента: бесплатно до freeClients, дальше — по действующей подписке (если ограничение включено). */
export async function assertCanAddClient(practiceId: string): Promise<void> {
    const terms = await practiceTerms();
    if (!terms.enforce) return;
    const p = await prisma.practice.findUnique({ where: { id: practiceId }, select: { paidUntil: true } });
    if (p?.paidUntil && p.paidUntil > new Date()) return;
    const n = await prisma.clientLink.count({ where: { practice: practiceId, status: { in: ["invited", "active"] } } });
    if (n >= terms.freeClients) throw new PracticeError(`The free plan covers ${terms.freeClients} clients — a practice subscription is needed for more`, 402);
}
