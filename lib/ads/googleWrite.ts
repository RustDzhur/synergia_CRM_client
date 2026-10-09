import { ProviderError } from "@/lib/http";
import { call, query } from "./google";

// Создание и запуск поисковых кампаний Google Ads по структурированному плану (его составляет робот из описания маркетолога).
// Всё создаётся ОДНИМ атомарным запросом googleAds:mutate (бюджет, кампания, гео и язык, минус-слова, группы, ключевые слова,
// объявления) и ВСЕГДА в статусе PAUSED: деньги начинают тратиться только после отдельного включения (ads_set_status), которое
// всегда подтверждает человек. Лимиты длин — из правил Google Ads (адаптивное поисковое объявление).

export const LIMITS = { headline: 30, description: 90, path: 15, keyword: 80, headlinesMin: 3, headlinesMax: 15, descriptionsMin: 2, descriptionsMax: 4, groupsMax: 10, keywordsPerGroupMax: 80, negativesMax: 100 };
export type MatchType = "EXACT" | "PHRASE" | "BROAD";
export type Bidding = "maximize_clicks" | "maximize_conversions" | "manual_cpc";

export interface AdsPlan {
    name: string;
    url: string;
    dailyBudget: number; // в валюте аккаунта
    bidding: Bidding;
    maxCpc?: number;
    country: string; // ISO-2, например DE
    locations: string[]; // города/регионы по названию (пусто — вся страна)
    language: string; // ISO-639-1, например de
    negatives: string[];
    groups: { name: string; keywords: { text: string; match: MatchType }[]; headlines: string[]; descriptions: string[]; path1?: string; path2?: string }[];
}

const s = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\p{Cc}]/gu, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");
const MATCH = ["EXACT", "PHRASE", "BROAD"];
export class PlanError extends Error {}

/** Проверка и нормализация плана: всё, что нарушает правила Google Ads, — понятная ошибка, а не сбой на стороне Google. */
export function validatePlan(raw: unknown): { plan: AdsPlan; warnings: string[] } {
    const r = (raw ?? {}) as Record<string, any>;
    const warnings: string[] = [];
    const fail = (m: string): never => { throw new PlanError(m); };
    const name = s(r.name, 120) || fail("name is required");
    let url = s(r.url, 500);
    try { const u = new URL(url); if (!/^https?:$/.test(u.protocol)) throw 0; url = u.toString(); } catch { fail("url must be a full website address like https://example.com/page"); }
    const dailyBudget = Number(r.dailyBudget);
    if (!Number.isFinite(dailyBudget) || dailyBudget <= 0) fail("dailyBudget must be a positive number (per day, in the account currency)");
    if (dailyBudget > 100000) fail("dailyBudget looks too large");
    const bidding = (["maximize_clicks", "maximize_conversions", "manual_cpc"].includes(r.bidding) ? r.bidding : "maximize_clicks") as Bidding;
    const country = s(r.country, 2).toUpperCase();
    if (!/^[A-Z]{2}$/.test(country)) fail("country must be a 2-letter code like DE");
    const language = s(r.language, 5).toLowerCase();
    if (!/^[a-z]{2}$/.test(language)) fail("language must be a 2-letter code like de");
    const locations = (Array.isArray(r.locations) ? r.locations : []).map((x: unknown) => s(x, 80)).filter(Boolean).slice(0, 20);
    const negatives = Array.from(new Set((Array.isArray(r.negatives) ? r.negatives : []).map((x: unknown) => s(x, LIMITS.keyword).toLowerCase()).filter(Boolean))).slice(0, LIMITS.negativesMax) as string[];
    const groupsIn = Array.isArray(r.groups) ? r.groups : [];
    if (!groupsIn.length) fail("at least one ad group is required");
    if (groupsIn.length > LIMITS.groupsMax) fail(`at most ${LIMITS.groupsMax} ad groups per campaign`);
    const groups: AdsPlan["groups"] = groupsIn.map((g: any, i: number) => {
        const gname = s(g?.name, 100) || fail(`group ${i + 1}: name is required`);
        const kws = (Array.isArray(g?.keywords) ? g.keywords : []).map((k: any) => {
            const text = s(typeof k === "string" ? k : k?.text, LIMITS.keyword).toLowerCase().replace(/[!@%^()={};~`<>?\\|]/g, "");
            const m = String(typeof k === "string" ? "PHRASE" : k?.match ?? "PHRASE").toUpperCase();
            return { text, match: (MATCH.includes(m) ? m : "PHRASE") as MatchType };
        }).filter((k: { text: string }) => k.text && k.text.split(" ").length <= 10);
        const seen = new Set<string>();
        const keywords = kws.filter((k: { text: string; match: string }) => { const id = `${k.text}|${k.match}`; if (seen.has(id)) return false; seen.add(id); return true; }).slice(0, LIMITS.keywordsPerGroupMax);
        if (!keywords.length) fail(`group «${gname}»: at least one keyword is required`);
        const headlines = Array.from(new Set((Array.isArray(g?.headlines) ? g.headlines : []).map((x: unknown) => s(x, 200)).filter(Boolean))) as string[];
        const tooLongH = headlines.filter((h) => h.length > LIMITS.headline);
        if (tooLongH.length) fail(`group «${gname}»: headline longer than ${LIMITS.headline} characters: «${tooLongH[0]}» (${tooLongH[0].length})`);
        if (headlines.length < LIMITS.headlinesMin || headlines.length > LIMITS.headlinesMax) fail(`group «${gname}»: need ${LIMITS.headlinesMin}–${LIMITS.headlinesMax} distinct headlines (got ${headlines.length})`);
        if (headlines.length < 8) warnings.push(`group «${gname}»: only ${headlines.length} headlines — 8–15 give Google more combinations and better ad strength`);
        const descriptions = Array.from(new Set((Array.isArray(g?.descriptions) ? g.descriptions : []).map((x: unknown) => s(x, 300)).filter(Boolean))) as string[];
        const tooLongD = descriptions.filter((d) => d.length > LIMITS.description);
        if (tooLongD.length) fail(`group «${gname}»: description longer than ${LIMITS.description} characters: «${tooLongD[0].slice(0, 40)}…» (${tooLongD[0].length})`);
        if (descriptions.length < LIMITS.descriptionsMin || descriptions.length > LIMITS.descriptionsMax) fail(`group «${gname}»: need ${LIMITS.descriptionsMin}–${LIMITS.descriptionsMax} distinct descriptions (got ${descriptions.length})`);
        const path1 = s(g?.path1, 40), path2 = s(g?.path2, 40);
        if (path1.length > LIMITS.path || path2.length > LIMITS.path) fail(`group «${gname}»: display path parts must be at most ${LIMITS.path} characters`);
        if (keywords.some((k: { match: string }) => k.match === "BROAD")) warnings.push(`group «${gname}»: broad match keywords can waste budget — use them only with conversion tracking`);
        return { name: gname, keywords, headlines, descriptions, ...(path1 ? { path1 } : {}), ...(path2 && path1 ? { path2 } : {}) };
    });
    if (!negatives.length) warnings.push("no negative keywords — add words like «free», «jobs», «diy» that do not match your customers");
    const maxCpc = Number(r.maxCpc);
    return { plan: { name, url, dailyBudget: Math.round(dailyBudget * 100) / 100, bidding, ...(Number.isFinite(maxCpc) && maxCpc > 0 ? { maxCpc } : {}), country, locations, language, negatives, groups }, warnings };
}

const cid = (id: string) => String(id).replace(/\D/g, "");
const micros = (n: number) => String(Math.round(n * 1_000_000));

export async function resolveLanguage(token: string, customer: string, code: string, login?: string): Promise<string> {
    const rows = await query<{ languageConstant?: { resourceName?: string } }>(token, customer, `SELECT language_constant.resource_name FROM language_constant WHERE language_constant.code = '${code.replace(/[^a-z]/g, "")}' LIMIT 1`, login);
    return rows[0]?.languageConstant?.resourceName ?? "";
}

export async function resolveLocations(token: string, country: string, names: string[], login?: string): Promise<string[]> {
    type Sug = { geoTargetConstantSuggestions?: { geoTargetConstant?: { resourceName?: string; countryCode?: string; targetType?: string } }[] };
    const out: string[] = [];
    const ask = async (list: string[]) => {
        const r = await call<Sug>(token, "/geoTargetConstants:suggest", { method: "POST", body: { locale: "en", countryCode: country, locationNames: { names: list } }, loginCustomerId: login });
        return r.geoTargetConstantSuggestions ?? [];
    };
    if (names.length) {
        for (const sug of await ask(names)) {
            const g = sug.geoTargetConstant;
            if (g?.resourceName && (!g.countryCode || g.countryCode === country) && !out.includes(g.resourceName)) out.push(g.resourceName);
        }
        if (out.length) return out;
    }
    // вся страна
    const countryName = new Intl.DisplayNames(["en"], { type: "region" }).of(country) ?? country;
    for (const sug of await ask([countryName])) {
        const g = sug.geoTargetConstant;
        if (g?.resourceName && g.targetType === "Country" && g.countryCode === country) return [g.resourceName];
    }
    throw new ProviderError(`Could not find the location «${names[0] ?? country}» in Google Ads`);
}

/** Тело атомарного запроса googleAds:mutate для плана (без обращений к сети — проверяется тестами). */
export function buildMutation(customer: string, plan: AdsPlan, geo: string[], language: string, stamp: string) {
    const c = cid(customer);
    const budget = `customers/${c}/campaignBudgets/-1`;
    const camp = `customers/${c}/campaigns/-2`;
    const ops: Record<string, unknown>[] = [];
    ops.push({ campaignBudgetOperation: { create: { resourceName: budget, name: `${plan.name} budget ${stamp}`, amountMicros: micros(plan.dailyBudget), deliveryMethod: "STANDARD", explicitlyShared: false } } });
    const bid: Record<string, unknown> = plan.bidding === "manual_cpc" ? { manualCpc: { enhancedCpcEnabled: false } } : plan.bidding === "maximize_conversions" ? { maximizeConversions: {} } : { targetSpend: plan.maxCpc ? { cpcBidCeilingMicros: micros(plan.maxCpc) } : {} };
    ops.push({ campaignOperation: { create: { resourceName: camp, name: plan.name, status: "PAUSED", advertisingChannelType: "SEARCH", campaignBudget: budget, networkSettings: { targetGoogleSearch: true, targetSearchNetwork: false, targetContentNetwork: false, targetPartnerSearchNetwork: false }, containsEuPoliticalAdvertising: "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING", ...bid } } });
    for (const g of geo) ops.push({ campaignCriterionOperation: { create: { campaign: camp, location: { geoTargetConstant: g } } } });
    if (language) ops.push({ campaignCriterionOperation: { create: { campaign: camp, language: { languageConstant: language } } } });
    for (const n of plan.negatives) ops.push({ campaignCriterionOperation: { create: { campaign: camp, negative: true, keyword: { text: n, matchType: "PHRASE" } } } });
    plan.groups.forEach((g, i) => {
        const ag = `customers/${c}/adGroups/${-10 - i}`;
        ops.push({ adGroupOperation: { create: { resourceName: ag, campaign: camp, name: g.name, status: "ENABLED", type: "SEARCH_STANDARD", ...(plan.bidding === "manual_cpc" ? { cpcBidMicros: micros(plan.maxCpc ?? Math.max(0.5, plan.dailyBudget / 20)) } : {}) } } });
        for (const k of g.keywords) ops.push({ adGroupCriterionOperation: { create: { adGroup: ag, status: "ENABLED", keyword: { text: k.text, matchType: k.match } } } });
        ops.push({ adGroupAdOperation: { create: { adGroup: ag, status: "ENABLED", ad: { finalUrls: [plan.url], responsiveSearchAd: { headlines: g.headlines.map((text) => ({ text })), descriptions: g.descriptions.map((text) => ({ text })), ...(g.path1 ? { path1: g.path1 } : {}), ...(g.path2 ? { path2: g.path2 } : {}) } } } } });
    });
    return { mutateOperations: ops, partialFailure: false };
}

/** Создаёт кампанию (на паузе). Возвращает её идентификатор. */
export async function createCampaign(token: string, customer: string, plan: AdsPlan, login?: string): Promise<{ campaignId: string; campaign: string }> {
    const c = cid(customer);
    const [geo, language] = await Promise.all([resolveLocations(token, plan.country, plan.locations, login), resolveLanguage(token, c, plan.language, login)]);
    if (!language) throw new ProviderError(`Google Ads has no language «${plan.language}»`);
    const body = buildMutation(c, plan, geo, language, new Date().toISOString().slice(0, 16));
    const res = await call<{ mutateOperationResponses?: { campaignResult?: { resourceName?: string } }[] }>(token, `/customers/${c}/googleAds:mutate`, { method: "POST", body, loginCustomerId: login });
    const rn = (res.mutateOperationResponses ?? []).map((x) => x.campaignResult?.resourceName).find(Boolean) ?? "";
    return { campaignId: rn.split("/").pop() ?? "", campaign: rn };
}

export async function setCampaignStatus(token: string, customer: string, campaignId: string, status: "ENABLED" | "PAUSED", login?: string) {
    const c = cid(customer);
    if (!/^\d+$/.test(campaignId)) throw new ProviderError("Invalid campaign id");
    await call(token, `/customers/${c}/campaigns:mutate`, { method: "POST", body: { operations: [{ updateMask: "status", update: { resourceName: `customers/${c}/campaigns/${campaignId}`, status } }] }, loginCustomerId: login });
}

export async function keywordIdeas(token: string, customer: string, seeds: string[], country: string, language: string, login?: string) {
    const c = cid(customer);
    const [geo, lang] = await Promise.all([resolveLocations(token, country, [], login), resolveLanguage(token, c, language, login)]);
    const res = await call<{ results?: { text?: string; keywordIdeaMetrics?: { avgMonthlySearches?: string; competition?: string; lowTopOfPageBidMicros?: string; highTopOfPageBidMicros?: string } }[] }>(token, `/customers/${c}:generateKeywordIdeas`, { method: "POST", body: { keywordSeed: { keywords: seeds.slice(0, 10) }, geoTargetConstants: geo, language: lang, keywordPlanNetwork: "GOOGLE_SEARCH", pageSize: 40 }, loginCustomerId: login });
    return (res.results ?? []).slice(0, 40).map((r) => ({ keyword: r.text ?? "", monthlySearches: Number(r.keywordIdeaMetrics?.avgMonthlySearches) || 0, competition: (r.keywordIdeaMetrics?.competition ?? "").toLowerCase(), cpcLow: (Number(r.keywordIdeaMetrics?.lowTopOfPageBidMicros) || 0) / 1e6, cpcHigh: (Number(r.keywordIdeaMetrics?.highTopOfPageBidMicros) || 0) / 1e6 }));
}
