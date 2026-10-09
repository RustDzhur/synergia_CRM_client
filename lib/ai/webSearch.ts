import { openaiBase } from "./provider";

// Поиск в интернете для роботов-исследователей. Два источника:
//  1) Brave Search API (если задан BRAVE_SEARCH_API_KEY) — обычные результаты поиска со страной и языком;
//  2) поиск OpenAI (web_search_preview в Responses API) — тот же OPENAI_API_KEY, что уже стоит для голоса и чата: ничего подключать не нужно.
// Результат — недоверенные данные (run.ts помечает его как «чужой текст»).

export class SearchError extends Error {}
export interface SearchHit { title: string; url: string; snippet: string }
export interface SearchResult { engine: string; answer?: string; results: SearchHit[] }

const COUNTRY = /^[A-Za-z]{2}$/;

/** Разбор ответа Responses API: текст ответа и источники (url_citation). */
export function parseOpenAiSearch(json: unknown): { answer: string; results: SearchHit[] } {
    const out = (json as { output?: unknown[] })?.output ?? [];
    let answer = "";
    const seen = new Map<string, SearchHit>();
    for (const item of out as { type?: string; content?: { type?: string; text?: string; annotations?: { type?: string; url?: string; title?: string }[] }[] }[]) {
        if (item?.type !== "message") continue;
        for (const c of item.content ?? []) {
            if (c?.type !== "output_text") continue;
            answer += (answer ? "\n" : "") + String(c.text ?? "");
            for (const a of c.annotations ?? []) if (a?.type === "url_citation" && a.url && !seen.has(a.url)) seen.set(a.url, { title: String(a.title ?? "").slice(0, 160), url: a.url, snippet: "" });
        }
    }
    return { answer: answer.slice(0, 9000), results: Array.from(seen.values()).slice(0, 20) };
}

async function brave(query: string, country: string, lang: string): Promise<SearchResult> {
    const u = new URL("https://api.search.brave.com/res/v1/web/search");
    u.searchParams.set("q", query); u.searchParams.set("count", "12");
    if (country) u.searchParams.set("country", country.toLowerCase());
    if (lang) u.searchParams.set("search_lang", lang.toLowerCase());
    const res = await fetch(u, { headers: { Accept: "application/json", "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY ?? "" }, signal: AbortSignal.timeout(20_000) }).catch(() => { throw new SearchError("The search service did not answer"); });
    if (!res.ok) throw new SearchError(`The search service answered with status ${res.status}`);
    const j = (await res.json()) as { web?: { results?: { title?: string; url?: string; description?: string }[] } };
    return { engine: "brave", results: (j.web?.results ?? []).map((r) => ({ title: String(r.title ?? "").slice(0, 160), url: String(r.url ?? ""), snippet: String(r.description ?? "").replace(/<[^>]+>/g, "").slice(0, 300) })).filter((r) => r.url) };
}

async function openaiSearch(query: string, country: string): Promise<SearchResult> {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new SearchError("Web search is not configured: set OPENAI_API_KEY (or BRAVE_SEARCH_API_KEY) on the server");
    const res = await fetch(`${openaiBase()}/responses`, {
        method: "POST", signal: AbortSignal.timeout(90_000),
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
            model: process.env.AI_SEARCH_MODEL || "gpt-4.1-mini",
            tools: [{ type: "web_search_preview", search_context_size: "high", ...(country ? { user_location: { type: "approximate", country: country.toUpperCase() } } : {}) }],
            tool_choice: { type: "web_search_preview" },
            input: `Search the web and list the most relevant public websites and facts for this request. Give concrete names, prices and dates, and cite every source.\n\nRequest: ${query}`,
        }),
    }).catch(() => { throw new SearchError("The search service did not answer"); });
    if (!res.ok) throw new SearchError(`The search service answered with status ${res.status}`);
    const parsed = parseOpenAiSearch(await res.json());
    return { engine: "openai", ...parsed };
}

export async function webSearch(query: string, country = "", lang = ""): Promise<SearchResult> {
    const c = COUNTRY.test(country) ? country : "";
    if (process.env.BRAVE_SEARCH_API_KEY) {
        try { return await brave(query, c, lang); } catch (e) { if (!process.env.OPENAI_API_KEY) throw e; }
    }
    return openaiSearch(query, c);
}
