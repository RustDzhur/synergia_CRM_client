import { afterEach, describe, expect, it, vi } from "vitest";
import { complete } from "@/lib/ai/provider";

const ok = () => new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200, headers: { "content-type": "application/json" } });
const bad = (message: string) => new Response(JSON.stringify({ error: { message } }), { status: 400, headers: { "content-type": "application/json" } });

describe("complete: 400 из-за лимита ответа лечится подстройкой параметра", () => {
    afterEach(() => vi.unstubAllGlobals());
    it("у модели потолок ниже запрошенного — повтор с потолком модели", async () => {
        process.env.OPENAI_API_KEY = "k"; process.env.AI_PROVIDER = "openai";
        const bodies: any[] = [];
        vi.stubGlobal("fetch", vi.fn(async (_u: string, init: any) => {
            const b = JSON.parse(init.body); bodies.push(b);
            return b.max_tokens > 4096 ? bad("max_tokens is too large: 8000. This model supports at most 4096 completion tokens, whereas you provided 8000.") : ok();
        }));
        const r = await complete("sys", [{ role: "user", text: "hi" }], [], { maxTokens: 8000 });
        expect(r.text).toBe("ok");
        expect(bodies.map((b) => b.max_tokens)).toEqual([8000, 4096]);
    });
    it("модель требует max_completion_tokens — подставляем его", async () => {
        process.env.OPENAI_API_KEY = "k"; process.env.AI_PROVIDER = "openai";
        const bodies: any[] = [];
        vi.stubGlobal("fetch", vi.fn(async (_u: string, init: any) => {
            const b = JSON.parse(init.body); bodies.push(b);
            return "max_tokens" in b ? bad("Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.") : ok();
        }));
        expect((await complete("sys", [{ role: "user", text: "hi" }], [], { maxTokens: 2000 })).text).toBe("ok");
        expect(Object.keys(bodies[1])).toContain("max_completion_tokens");
    });
});
