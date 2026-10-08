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
        delete process.env.AI_VOICE_STT_MODEL;
        expect(cloudSttModel()).toBe("whisper-1");
    });
});
