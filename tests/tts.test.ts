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
