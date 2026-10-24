import { describe, expect, it } from "vitest";
import { mentionsAds, normalizeDraft, normalizeRoutine, parseModelReply } from "@/lib/office/hireVoice";
import { OfficeError } from "@/lib/office/store";

describe("найм голосом: разбор диктовки (lib/office/hireVoice)", () => {
    it("черновик из ответа модели: поля проходят как есть и чистятся", () => {
        const d = normalizeDraft({
            name: "  Vik  ",
            title: "Google Ads manager",
            skills: ["ads", "tasks", "data"],
            instructions: "Manage the search campaigns.",
            zone: "marketing",
            accent: "amber",
            routines: [{ text: "Check campaigns", kind: "daily", time: "09:00" }],
        });
        expect(d).toEqual({
            name: "Vik",
            title: "Google Ads manager",
            skills: ["ads", "tasks", "data"],
            instructions: "Manage the search campaigns.",
            zone: "marketing",
            accent: "amber",
            routines: [{ text: "Check campaigns", kind: "daily", time: "09:00" }],
        });
    });

    it("навыки — только из каталога: служебные и неизвестные отбрасываются, повторы схлопываются", () => {
        const d = normalizeDraft({ skills: ["ads", "monitor", "blogwrite", "ads", "unknown", "crm"] });
        expect(d.skills).toEqual(["ads", "crm"]);
    });

    it("неизвестные комната и цвет — по умолчанию, имя — Robo, длины по лимитам формы", () => {
        const d = normalizeDraft({ name: "x".repeat(100), title: "y".repeat(100), instructions: "i".repeat(3000), zone: "platform", accent: "hotpink" });
        expect(d.name).toBe("x".repeat(40)); // имя обрезано до лимита формы
        expect(d.title.length).toBe(60);
        expect(d.instructions.length).toBe(1500);
        expect(d.zone).toBe("office");
        expect(d.accent).toBe("lime");
    });

    it("пустое имя и пустой объект — безопасные значения по умолчанию", () => {
        const d = normalizeDraft(null);
        expect(d.name).toBe("Robo");
        expect(d.skills).toEqual([]);
        expect(d.zone).toBe("office");
        expect(d.routines).toEqual([]);
    });

    it("регулярные задачи: без текста или времени — нет задачи, day ограничивается, максимум 5", () => {
        const d = normalizeDraft({
            routines: [
                { text: "Weekly report", kind: "weekly", time: "09:00", day: 12 },
                { text: "Monthly", kind: "monthly", time: "08:30", day: 40 },
                { text: "", kind: "daily", time: "09:00" },
                { text: "No time", kind: "daily" },
                { text: "Bad kind", kind: "hourly", time: "09:00" },
                { text: "t1", kind: "daily", time: "10:00" },
                { text: "t2", kind: "daily", time: "11:00" },
                { text: "t3", kind: "daily", time: "12:00" },
                { text: "t4", kind: "daily", time: "13:00" },
                { text: "t5", kind: "daily", time: "14:00" },
                { text: "t6", kind: "daily", time: "15:00" },
            ],
        });
        expect(d.routines).toEqual([
            { text: "Weekly report", kind: "weekly", time: "09:00", day: 6 },
            { text: "Monthly", kind: "monthly", time: "08:30", day: 28 },
            { text: "Bad kind", kind: "daily", time: "09:00" },
            { text: "t1", kind: "daily", time: "10:00" },
            { text: "t2", kind: "daily", time: "11:00" },
        ]);
    });

    it("normalizeRoutine: невалидное время — задачи нет", () => {
        expect(normalizeRoutine({ text: "x", kind: "daily", time: "25:99" })).toBeNull();
        expect(normalizeRoutine("garbage")).toBeNull();
        expect(normalizeRoutine(null)).toBeNull();
    });

    it("ответ модели: JSON как есть, в код-блоке и с пояснением вокруг — разбирается", () => {
        expect(parseModelReply('{"name":"Lena","zone":"sales"}')).toEqual({ name: "Lena", zone: "sales" });
        expect(parseModelReply("Here is the draft:\n```json\n{\"name\":\"Lena\"}\n```\nDone.")).toEqual({ name: "Lena" });
    });

    it("ответ модели без JSON — понятная ошибка", () => {
        expect(() => parseModelReply("Sorry, I cannot do that.")).toThrow(OfficeError);
        expect(() => parseModelReply("")).toThrow(OfficeError);
    });

    it("реклама в диктовке опознаётся на всех языках, ложные слова — нет", () => {
        expect(mentionsAds("Найми робота для рекламы в Google Ads")).toBe(true);
        expect(mentionsAds("Hire someone to manage our ads")).toBe(true);
        expect(mentionsAds("Stelle jemanden für Google Ads ein")).toBe(true);
        expect(mentionsAds("Reklama uchun robot yollang")).toBe(true);
        expect(mentionsAds("Hire a robot to send loads of emails")).toBe(false);
        expect(mentionsAds("Нанять робота для счетов")).toBe(false);
    });
});
