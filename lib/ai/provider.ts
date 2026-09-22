import { ProviderError, fetchProvider } from "@/lib/http";

// Тонкий слой над API языковых моделей. Внутри CRM разговор — это список Msg; адаптеры переводят его в формат
// OpenAI (Chat Completions + tools) или Anthropic (Messages + tools). Ключ — только в переменных окружения сервера.
export type Msg =
    | { role: "user"; text: string }
    | { role: "assistant"; text: string; calls?: ToolCall[] }
    | { role: "tool"; callId: string; name: string; content: string };
export interface ToolCall { id: string; name: string; args: Record<string, unknown> }
export interface ToolDef { name: string; description: string; parameters: Record<string, unknown> }
export interface Reply { text: string; calls: ToolCall[] }

export type ProviderId = "anthropic" | "openai";

export function aiProvider(): ProviderId | null {
    const wanted = process.env.AI_PROVIDER;
    if (wanted === "openai" && process.env.OPENAI_API_KEY) return "openai";
    if (wanted === "anthropic" && process.env.ANTHROPIC_API_KEY) return "anthropic";
    if (process.env.ANTHROPIC_API_KEY) return "anthropic";
    if (process.env.OPENAI_API_KEY) return "openai";
    return null;
}
export const aiConfigured = () => !!aiProvider();
// Модели меняются — имя всегда можно задать переменной AI_MODEL
export const aiModel = (p: ProviderId) => process.env.AI_MODEL || (p === "anthropic" ? "claude-sonnet-5" : "gpt-4.1-mini");

const trim = (s: string) => s.replace(/\/+$/, "");

async function post<T>(url: string, headers: Record<string, string>, body: unknown): Promise<T> {
    const res = await fetchProvider(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) }, 55000);
    const json = (await res.json().catch(() => null)) as ({ error?: { message?: string } | string } & T) | null;
    if (!res.ok || !json) {
        const detail = typeof json?.error === "string" ? json.error : json?.error?.message;
        console.error("AI provider error", res.status, detail);
        throw new ProviderError(res.status === 401 ? "The AI provider rejected the API key" : res.status === 429 ? "The AI provider is busy or out of quota. Try again later." : `The AI provider returned an error (${res.status})`);
    }
    return json;
}

// ── OpenAI ──
async function openai(system: string, msgs: Msg[], tools: ToolDef[]): Promise<Reply> {
    const messages: unknown[] = [{ role: "system", content: system }];
    for (const m of msgs) {
        if (m.role === "user") messages.push({ role: "user", content: m.text });
        else if (m.role === "assistant") messages.push({ role: "assistant", content: m.text || null, ...(m.calls?.length ? { tool_calls: m.calls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: JSON.stringify(c.args) } })) } : {}) });
        else messages.push({ role: "tool", tool_call_id: m.callId, content: m.content });
    }
    const j = await post<{ choices?: { message?: { content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[] }>(
        `${trim(process.env.OPENAI_API_URL || "https://api.openai.com/v1")}/chat/completions`,
        { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        { model: aiModel("openai"), messages, tools: tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } })) }
    );
    const msg = j.choices?.[0]?.message;
    if (!msg) throw new ProviderError("The AI provider returned an empty answer");
    return { text: msg.content ?? "", calls: (msg.tool_calls ?? []).map((c) => ({ id: c.id, name: c.function.name, args: parseArgs(c.function.arguments) })) };
}

// ── Anthropic ──
async function anthropic(system: string, msgs: Msg[], tools: ToolDef[]): Promise<Reply> {
    const messages: { role: "user" | "assistant"; content: unknown[] }[] = [];
    const push = (role: "user" | "assistant", block: unknown) => {
        const last = messages[messages.length - 1];
        if (last && last.role === role) last.content.push(block);
        else messages.push({ role, content: [block] });
    };
    for (const m of msgs) {
        if (m.role === "user") push("user", { type: "text", text: m.text });
        else if (m.role === "assistant") {
            if (m.text) push("assistant", { type: "text", text: m.text });
            for (const c of m.calls ?? []) push("assistant", { type: "tool_use", id: c.id, name: c.name, input: c.args });
        } else push("user", { type: "tool_result", tool_use_id: m.callId, content: m.content });
    }
    const j = await post<{ content?: { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }[] }>(
        `${trim(process.env.ANTHROPIC_API_URL || "https://api.anthropic.com/v1")}/messages`,
        { "x-api-key": process.env.ANTHROPIC_API_KEY ?? "", "anthropic-version": "2023-06-01" },
        { model: aiModel("anthropic"), max_tokens: 2000, system, messages, tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })) }
    );
    const blocks = j.content ?? [];
    return {
        text: blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n").trim(),
        calls: blocks.filter((b) => b.type === "tool_use").map((b) => ({ id: b.id ?? "", name: b.name ?? "", args: b.input ?? {} })),
    };
}

function parseArgs(raw: string): Record<string, unknown> {
    try {
        const v = JSON.parse(raw || "{}");
        return v && typeof v === "object" && !Array.isArray(v) ? v : {};
    } catch {
        return {};
    }
}

export async function complete(system: string, msgs: Msg[], tools: ToolDef[]): Promise<Reply> {
    const p = aiProvider();
    if (!p) throw new ProviderError("AI is not configured on this site");
    return p === "anthropic" ? anthropic(system, msgs, tools) : openai(system, msgs, tools);
}
