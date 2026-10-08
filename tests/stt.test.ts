import { describe, expect, it } from "vitest";
import { UZ_STT_PROMPT, isPhantomTranscript } from "@/lib/ai/provider";

describe("фантомные ответы распознавания", () => {
    it("подсказка узбекского словаря, вернувшаяся как «речь», отбрасывается; живая фраза — нет", () => {
        expect(isPhantomTranscript(UZ_STT_PROMPT)).toBe(true);
        expect(isPhantomTranscript(UZ_STT_PROMPT.slice(30, 110))).toBe(true);
        // короткие настоящие команды, похожие на примеры из подсказки, — не фантом
        expect(isPhantomTranscript("Yangi vazifa yarat.")).toBe(false);
        expect(isPhantomTranscript("Salom, Ayris")).toBe(false);
        expect(isPhantomTranscript("Ayris, to‘lanmagan hisob-fakturalarni ko‘rsat")).toBe(false);
        expect(isPhantomTranscript("Ayris, mijoz Karimov uchun yangi hisob-faktura yarat")).toBe(false);
        expect(isPhantomTranscript("Спасибо за просмотр")).toBe(true);
        expect(isPhantomTranscript("")).toBe(true);
        // одиночные английские галлюцинации Whisper на тишине — фантом; «ok» — живая команда подтверждения, её не трогаем
        expect(isPhantomTranscript("you")).toBe(true);
        expect(isPhantomTranscript("um")).toBe(true);
        expect(isPhantomTranscript("ok")).toBe(false);
    });
});

import { afterEach } from "vitest";
import { aiModel, cloudSttModel, openaiBase } from "@/lib/ai/provider";

describe("шлюзы отключены", () => {
    const saved = { ...process.env };
    afterEach(() => { process.env = { ...saved }; });

    it("адрес шлюза из старого .env игнорируется, обычный адрес и пустое значение работают", () => {
        process.env.OPENAI_API_URL = "http://omniroute:20128/v1";
        expect(openaiBase()).toBe("https://api.openai.com/v1");
        process.env.OPENAI_API_URL = "https://openrouter.ai/api/v1";
        expect(openaiBase()).toBe("https://api.openai.com/v1");
        process.env.OPENAI_API_URL = "https://proxy.example.com/v1/";
        expect(openaiBase()).toBe("https://proxy.example.com/v1");
        delete process.env.OPENAI_API_URL;
        expect(openaiBase()).toBe("https://api.openai.com/v1");
    });
    it("имена моделей вида openrouter/openai/… очищаются", () => {
        process.env.AI_MODEL = "openrouter/openai/gpt-4.1-mini";
        expect(aiModel("openai")).toBe("gpt-4.1-mini");
        process.env.AI_VOICE_STT_MODEL = "openrouter/openai/whisper-large-v3-turbo";
        expect(cloudSttModel()).toBe("whisper-1"); // такой модели у OpenAI нет — берём по умолчанию
        process.env.AI_MODEL = "openrouter/anthropic/claude-sonnet-5.5";
        expect(aiModel("openai")).toBe("gpt-4.1-mini");
        process.env.AI_MODEL = "cc/claude-sonnet-4";
        expect(aiModel("openai")).toBe("gpt-4.1-mini"); // чужое имя из старого .env — OpenAI ответил бы 400
        process.env.AI_MODEL = "gpt-4.1";
        expect(aiModel("openai")).toBe("gpt-4.1");
        process.env.AI_API_URL = "https://api.deepseek.com/v1";
        process.env.AI_MODEL = "deepseek-chat";
        expect(aiModel("openai")).toBe("deepseek-chat"); // прямой провайдер чата — имя не трогаем
        delete process.env.AI_VOICE_STT_MODEL;
        expect(cloudSttModel()).toBe("whisper-1");
    });
});

import { vi } from "vitest";
import { transcribeAudio } from "@/lib/ai/provider";

describe("запрос распознавания узбекского", () => {
    const saved = { ...process.env };
    afterEach(() => { process.env = { ...saved }; vi.unstubAllGlobals(); });
    const audio = Buffer.from("fake-audio");
    const ok = () => new Response(JSON.stringify({ text: "Salom Ayris" }), { status: 200 });

    it("gpt-4o-transcribe: код uz не отправляется, язык назван в подсказке", async () => {
        process.env.OPENAI_API_KEY = "sk-test"; delete process.env.OPENAI_API_URL; delete process.env.TRANSCRIBE_API_URL; delete process.env.ELEVENLABS_API_KEY; delete process.env.AI_VOICE_STT_MODEL_UZ;
        const sent: FormData[] = [];
        vi.stubGlobal("fetch", vi.fn(async (_u: string, init: RequestInit) => { sent.push(init.body as FormData); return ok(); }));
        expect(await transcribeAudio(audio, "audio/webm", "uz")).toBe("Salom Ayris");
        expect(sent[0].get("model")).toBe("gpt-4o-transcribe");
        expect(sent[0].get("language")).toBeNull();
        expect(String(sent[0].get("prompt"))).toContain("Uzbek");
    });
    it("whisper-1: код uz отправляется; если провайдер его отверг (400 language) — повтор без кода", async () => {
        process.env.OPENAI_API_KEY = "sk-test"; process.env.AI_VOICE_STT_MODEL_UZ = "whisper-1"; delete process.env.OPENAI_API_URL; delete process.env.TRANSCRIBE_API_URL; delete process.env.ELEVENLABS_API_KEY;
        const langs: (string | null)[] = [];
        let n = 0;
        vi.stubGlobal("fetch", vi.fn(async (_u: string, init: RequestInit) => {
            langs.push((init.body as FormData).get("language") as string | null);
            return n++ === 0 ? new Response(JSON.stringify({ error: { message: "Language code 'uz' is not recognized." } }), { status: 400 }) : ok();
        }));
        expect(await transcribeAudio(audio, "audio/webm", "uz")).toBe("Salom Ayris");
        expect(langs).toEqual(["uz", null]);
    });
});

import { complete } from "@/lib/ai/provider";

describe("цепочка моделей чата при прямом OpenAI", () => {
    const saved = { ...process.env };
    afterEach(() => { process.env = { ...saved }; vi.unstubAllGlobals(); });
    it("модели шлюза из старого .env пропускаются: ответ даёт модель OpenAI с первой попытки", async () => {
        process.env.OPENAI_API_KEY = "sk-test"; delete process.env.OPENAI_API_URL; delete process.env.AI_API_URL; delete process.env.AI_API_KEY; delete process.env.AI_PROVIDER; delete process.env.ANTHROPIC_API_KEY;
        process.env.AI_MODEL = "auto/best-chat";
        process.env.AI_VOICE_MODEL = "openrouter/inclusionai/ling-3.1-flash";
        process.env.AI_FALLBACK_MODELS = "openrouter/inclusionai/ling-3.1-flash,auto/pro-fast,auto/pro-chat";
        const used: string[] = [];
        vi.stubGlobal("fetch", vi.fn(async (_u: string, init: RequestInit) => {
            const m = JSON.parse(String(init.body)).model as string;
            used.push(m);
            return /^gpt-/.test(m)
                ? new Response(JSON.stringify({ choices: [{ message: { content: "Salom!" } }] }), { status: 200 })
                : new Response(JSON.stringify({ error: { message: "invalid model ID" } }), { status: 400 });
        }));
        const r = await complete("sys", [{ role: "user", content: "hi" }] as never, [], { model: process.env.AI_VOICE_MODEL });
        expect(used).toEqual(["gpt-4.1-mini"]);
        expect(JSON.stringify(r)).toContain("Salom");
    });
});
