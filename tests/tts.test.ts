import { describe, expect, it } from "vitest";
import { detectLang, voiceFor } from "@/lib/ai/tts";

describe("озвучка: язык и голос", () => {
    it("узбекский: по подсказке и по знаку oʻ/gʻ; голоса родные узбекские", () => {
        expect(detectLang("Hisob-fakturalar tayyor", "uz")).toBe("uz");
        expect(detectLang("Oʻzbekiston", undefined)).toBe("uz");
        expect(voiceFor("uz", "f")).toBe("uz-UZ-MadinaNeural");
        expect(voiceFor("uz", "m")).toBe("uz-UZ-SardorNeural");
    });
    it("остальные языки определяются как раньше", () => {
        expect(detectLang("Rechnungen sind offen", undefined)).toBe("de");
        expect(detectLang("Привіт, як справи", "ru")).toBe("uk");
        expect(detectLang("Hello there", "de")).toBe("de");
        expect(detectLang("Hello there", undefined)).toBe("en");
    });
});

import { afterEach, vi } from "vitest";
import { synthesize } from "@/lib/ai/tts";

describe("озвучка при зависшем контейнере tts", () => {
    afterEach(() => { vi.unstubAllGlobals(); delete (globalThis as { __ttsDownUntil?: number }).__ttsDownUntil; });
    it("пока основной голос на паузе, запросов к нему нет — ответ сразу (клиент читает голосом браузера)", async () => {
        (globalThis as { __ttsDownUntil?: number }).__ttsDownUntil = Date.now() + 60_000;
        const f = vi.fn();
        vi.stubGlobal("fetch", f);
        await expect(synthesize("Salom, bugun ob-havo yaxshi", { lang: "uz" })).rejects.toThrow();
        expect(f).not.toHaveBeenCalled();
    });
    it("быстрая ошибка основного голоса: одна повторная попытка, пауза не включается", async () => {
        const f = vi.fn(async () => new Response("{}", { status: 500 }));
        vi.stubGlobal("fetch", f);
        await expect(synthesize("Salom, bugun ob-havo yaxshi", { lang: "uz" })).rejects.toThrow();
        expect(f).toHaveBeenCalledTimes(2);
        expect((globalThis as { __ttsDownUntil?: number }).__ttsDownUntil ?? 0).toBeLessThan(Date.now());
    });
});
