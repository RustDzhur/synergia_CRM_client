import { describe, expect, it } from "vitest";
import { UZ_STT_PROMPT, isPhantomTranscript } from "@/lib/ai/provider";

describe("фантомные ответы распознавания", () => {
    it("подсказка узбекского словаря, вернувшаяся как «речь», отбрасывается; живая фраза — нет", () => {
        expect(isPhantomTranscript("Yangi vazifa yarat.")).toBe(true);
        expect(isPhantomTranscript("to‘lanmagan hisob-fakturalarni ko‘rsat")).toBe(true);
        expect(isPhantomTranscript(UZ_STT_PROMPT)).toBe(true);
        expect(isPhantomTranscript("Ayris, mijoz Karimov uchun yangi hisob-faktura yarat")).toBe(false);
        expect(isPhantomTranscript("Спасибо за просмотр")).toBe(true);
        expect(isPhantomTranscript("")).toBe(true);
    });
});
