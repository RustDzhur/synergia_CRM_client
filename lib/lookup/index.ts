import { ProviderError, fetchProvider } from "@/lib/http";

// Автозаполнение реквизитов и адресов (ТЗ §16): единый интерфейс lookup(kind, query, country),
// за которым стоят разные провайдеры. Правила:
//   • провайдер заменяем — если его нет или он не ответил, человек просто вводит данные вручную;
//   • всё, что пришло от мока, помечается mock: true и подписывается в интерфейсе;
//   • ответы кэшируются в памяти на 10 минут — справочники меняются медленно, а лимиты у провайдеров есть.
//
// Реальные провайдеры: VIES (реквизиты по USt-IdNr в ЕС) и Нова Пошта (адреса в Украине, по ключу фирмы).
// Украинский поиск фирм по названию требует платного доступа (Opendatabot/YouControl) — до подключения
// работает демонстрационный провайдер, и интерфейс честно пишет, что данные демонстрационные.

export type LookupKind = "company" | "address";

export interface LookupHit {
    id: string;
    label: string; // то, что видно в подсказке
    detail?: string; // вторая строка подсказки
    fill?: Record<string, string>; // какие поля формы заполнить при выборе
}

export interface LookupOutcome {
    provider: string; // id провайдера, которым получен ответ
    providerLabel: string; // человеческое имя — его показывает интерфейс
    results: LookupHit[];
    mock?: boolean; // демонстрационные данные: подставлять можно, но с пометкой
    // Причина, по которой подсказок нет: код переводится интерфейсом (тексты — в messages),
    // detail — техническая строка провайдера, показывается как есть
    noteCode?: "too_short" | "vies_none" | "vies_unreachable" | "np_unreachable" | "mock" | "manual";
    noteDetail?: string;
}

// ── Кэш и лимиты ────────────────────────────────────────────────────────────────────────────────────
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_HITS = 8;
const cache = new Map<string, { at: number; outcome: LookupOutcome }>();

function fromCache(key: string): LookupOutcome | null {
    const hit = cache.get(key);
    if (!hit) return null;
    if (Date.now() - hit.at > CACHE_TTL_MS) {
        cache.delete(key);
        return null;
    }
    return hit.outcome;
}
function toCache(key: string, outcome: LookupOutcome): LookupOutcome {
    if (cache.size > 500) cache.clear(); // грубая, но предсказуемая граница памяти
    cache.set(key, { at: Date.now(), outcome });
    return outcome;
}

// ── VIES: реквизиты фирмы по номеру НДС в ЕС ────────────────────────────────────────────────────────
// Официальный REST-сервис Евросоюза, ключ не нужен. Ищет только по номеру НДС (не по названию).

interface ViesResponse { isValid?: boolean; name?: string; address?: string; userError?: string }

export async function viesLookup(vat: string, country: string): Promise<LookupHit[]> {
    const number = vat.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^[A-Z]{2}/, "");
    if (!/^\d{8,12}$/.test(number)) return [];
    const res = await fetchProvider(`https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${encodeURIComponent(country)}/vat/${encodeURIComponent(number)}`, {}, 12000);
    const json = (await res.json().catch(() => null)) as ViesResponse | null;
    if (!json?.isValid || !json.name) return [];
    return [
        {
            id: `${country}${number}`,
            label: json.name.trim(),
            detail: [json.address?.replace(/\s*\n\s*/g, ", ").trim(), `${country} ${number}`].filter(Boolean).join(" · "),
            fill: { name: json.name.trim(), ...(json.address ? { address: json.address.replace(/\s*\n\s*/g, ", ").trim() } : {}) },
        },
    ];
}

// ── Общая точка входа ───────────────────────────────────────────────────────────────────────────────
// addressProvider: адреса украинских фирм ищет подключённая Нова Пошта (ключ фирмы) — передаётся
// снаружи, чтобы этот модуль не тянул базу.

export interface LookupContext {
    addressSearch?: (query: string) => Promise<Array<{ ref: string; name: string; area?: string }>>;
}

export async function lookup(kind: LookupKind, query: string, country: string, ctx: LookupContext = {}): Promise<LookupOutcome> {
    const q = query.trim();
    if (q.length < 3) return { provider: "none", providerLabel: "", results: [], noteCode: "too_short" };
    const key = `${kind}:${country}:${q.toUpperCase()}`;
    const cached = fromCache(key);
    if (cached) return cached;

    if (kind === "company" && country !== "UA" && country !== "UZ") {
        try {
            const results = await viesLookup(q, country);
            return toCache(key, {
                provider: "vies",
                providerLabel: "VIES (ЕС)",
                results: results.slice(0, MAX_HITS),
                ...(results.length ? {} : { noteCode: "vies_none" as const }),
            });
        } catch (e) {
            return {
                provider: "vies",
                providerLabel: "VIES (ЕС)",
                results: [],
                noteCode: "vies_unreachable",
                noteDetail: e instanceof ProviderError ? e.message : "",
            };
        }
    }

    if (kind === "address" && ctx.addressSearch) {
        try {
            const cities = await ctx.addressSearch(q);
            return toCache(key, {
                provider: "novaposhta",
                providerLabel: "Нова Пошта",
                results: cities.slice(0, MAX_HITS).map((c) => ({
                    id: c.ref,
                    label: c.name,
                    detail: c.area,
                    // Отделение не подставляем: адрес фирмы — это улица в городе, а не номер отделения
                    fill: { address: [c.name, c.area].filter(Boolean).join(", "), city: c.name },
                })),
            });
        } catch (e) {
            return {
                provider: "novaposhta",
                providerLabel: "Нова Пошта",
                results: [],
                noteCode: "np_unreachable",
                noteDetail: e instanceof ProviderError ? e.message : "",
            };
        }
    }

    // Демонстрационный провайдер: честно помечен и подписан — до подключения платного ЄДР-провайдера
    if (kind === "company" && country === "UA") {
        const base = q.replace(/\s+/g, " ").slice(0, 60);
        return toCache(key, {
            provider: "mock",
            providerLabel: "Демо-данные",
            mock: true,
            results: [
                {
                    id: `mock-${base}`,
                    label: `ТОВ «${base}»`,
                    detail: "Демонстрационные реквизиты: ЄДРПОУ 12345678, Київ",
                    fill: { name: `ТОВ «${base}»`, code: "12345678", address: "м. Київ", status: "Діюче" },
                },
            ],
            noteCode: "mock",
        });
    }

    return { provider: "none", providerLabel: "", results: [], noteCode: "manual" };
}
