import { describe, expect, it } from "vitest";
import { stripWake, wakeKey } from "@/components/crm/AiAssistant/wake";

describe("имя «Айрис» в распознанной фразе", () => {
    it("узнаётся в разных написаниях и языках", () => {
        const heard = [
            "Salom, Ayris", "Salom Ayris!", "salom aris", "Салом Арис", "салом, Айрис", "Салом Айріс", "Ayrish, salom", "Salom Airis",
            "Ayrıs", "Salom Ayri's", "саломайрис", "Ай рис, привет", "ay ris", "Эйрис", "Привет, Айрис", "Hallo Ayris", "Hey Iris", "Айріс, створи задачу",
        ];
        const missed = heard.filter((t) => !stripWake(t).hit);
        expect(missed).toEqual([]);
    });
    it("обычные слова не принимаются за имя", () => {
        for (const t of ["рис с овощами", "Ira keldi", "bu yerda ris", "Paris", "Marisa bilan gaplashdim", "salom, buyurtma"]) expect(stripWake(t).hit).toBe(false);
    });
    it("имя снимается из просьбы, остальное сохраняется", () => {
        expect(stripWake("Salom, Ayris, to‘lanmagan hisob-fakturalarni ko‘rsat")).toEqual({ hit: true, rest: "Salom, to‘lanmagan hisob-fakturalarni ko‘rsat" });
        expect(stripWake("Айрис, створи задачу").rest).toBe("створи задачу");
        expect(wakeKey("Айрис")).toBe("ayris");
        expect(wakeKey("Ayrıs")).toBe("ayris");
    });
});
