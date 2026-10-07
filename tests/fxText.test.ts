import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fx } from "@/lib/sync/texts";
import { localizeFx } from "@/utils/fxText";

const read = (lang: string) => JSON.parse(readFileSync(path.join(__dirname, "..", "messages", `${lang}.json`), "utf8")).feedText as Record<string, string>;

describe("тексты ленты на языке интерфейса", () => {
    it("ключ и параметры переводятся, обычный текст остаётся как есть", () => {
        const en = read("en");
        const t = (key: string, p?: Record<string, string | number>) => (en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => String(p?.[k] ?? ""));
        expect(localizeFx(t, fx("payment_full", { number: "RE-1", paid: 100, currency: "EUR" }))).toBe("Invoice RE-1 paid in full: 100 EUR");
        expect(localizeFx(t, "Обычная заметка")).toBe("Обычная заметка");
        expect(localizeFx(t, "@@unknown_key|{}")).toBe("unknown_key");
    });

    it("все языки содержат одинаковый набор ключей и каждый ключ, который пишет сервер", () => {
        const [en, de, ua] = [read("en"), read("de"), read("ua")];
        expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort());
        expect(Object.keys(ua).sort()).toEqual(Object.keys(en).sort());
        // ключи, использованные в коде через fx("…"), существуют в словаре
        const used = new Set<string>();
        const walk = (dir: string) => {
            const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
            for (const f of readdirSync(dir)) {
                const full = path.join(dir, f);
                if (f === "node_modules" || f === ".next" || f === ".git" || f === "tests") continue;
                if (statSync(full).isDirectory()) walk(full);
                else if (/\.(ts|tsx)$/.test(f)) for (const m of readFileSync(full, "utf8").matchAll(/\bfx\(\s*"([a-z_]+)"/g)) used.add(m[1]);
            }
        };
        for (const d of ["app", "lib"]) walk(path.join(__dirname, "..", d));
        const missing = Array.from(used).filter((k) => !(k in en));
        expect(missing).toEqual([]);
        // статусы заказа собираются динамически: все семь должны быть в словаре
        for (const s of ["draft", "confirmed", "fulfilled", "invoiced", "paid", "closed", "cancelled"]) expect(en[`order_status_${s}`]).toBeTruthy();
    });
});
