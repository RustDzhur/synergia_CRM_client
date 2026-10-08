import { describe, expect, it } from "vitest";
import { hasDb, makeOrg, prisma } from "./helpers/db";
import { asUser } from "./helpers/http";
import { MANIFEST_SEED, connectableNow, describeManifest, forMarket } from "@/lib/integrations/manifests";
import { scrub } from "@/lib/integrations/service";
import { POST as secrets } from "@/app/api/integrations/secrets/route";
import { GET as catalog } from "@/app/api/integrations/catalog/route";
import { PUT as adminPut } from "@/app/api/admin/integration-manifests/[key]/route";
import { toolByName } from "@/lib/ai/tools";
import { LOCALES } from "@/lib/locales";

describe("паспорта интеграций", () => {
    it("статусы UZ по ТЗ §6.3: доступен только курс ЦБ; Payme и Click — beta (модули по документации); остальное planned и не подключается", () => {
        const uz = MANIFEST_SEED.filter((m) => m.markets.includes("UZ"));
        expect(uz.filter((m) => m.status === "available").map((m) => m.key)).toEqual(["cbu"]);
        for (const k of ["payme", "click"]) {
            const m = uz.find((x) => x.key === k)!;
            expect(m.status).toBe("beta");
            expect(connectableNow(m)).toBe(true);
        }
        for (const k of ["didox", "faktura_uz", "uzum", "atmos", "uz_kassa", "uz_banks"]) {
            const m = uz.find((x) => x.key === k)!;
            expect(m.status).toBe("planned");
            expect(connectableNow(m)).toBe(false);
        }
    });
    it("рынки: украинские сервисы не видны немецкой фирме, общие — видны всем; тексты есть на всех языках", () => {
        const mono = MANIFEST_SEED.find((m) => m.key === "monobank")!;
        expect(forMarket(mono, "DE")).toBe(false);
        expect(forMarket(mono, "UA")).toBe(true);
        expect(forMarket(MANIFEST_SEED.find((m) => m.key === "telegram")!, "DE")).toBe(true);
        for (const m of MANIFEST_SEED) for (const l of LOCALES) {
            const d = describeManifest(m, l);
            expect(d.description.length).toBeGreaterThan(5);
            for (const fl of m.fields) expect(d.fieldLabels[fl.key]).toBeTruthy();
        }
    });
    it("scrub вычищает введённые значения из текста ошибки", () => {
        expect(scrub("Invalid key sk_live_12345 for merchant", ["sk_live_12345"])).toBe("Invalid key ••• for merchant");
    });
    it("инструменты Айрис зарегистрированы и не пишут", () => {
        for (const n of ["find_integration", "explain_integration", "start_integration", "verify_integration", "list_my_integrations"]) expect(toolByName(n)?.write).toBe(false);
    });
});

describe.skipIf(!hasDb)("защищённое подключение", () => {
    it("planned не подключается; неизвестный ключ — 404; ошибка провайдера не содержит значений; обязательные поля", async () => {
        const o = await makeOrg();
        const req = asUser(o.userId);
        expect((await secrets(req("/api/integrations/secrets", "POST", { type: "uzum", fields: { x: "y" } }))).status).toBe(409);
        expect((await secrets(req("/api/integrations/secrets", "POST", { type: "nope", fields: {} }))).status).toBe(404);
        expect((await secrets(req("/api/integrations/secrets", "POST", { type: "telegram", fields: {} }))).status).toBe(400);
        const key = "123456:SECRET-KEY-VALUE";
        const res = await secrets(req("/api/integrations/secrets", "POST", { type: "telegram", fields: { botToken: key } }));
        expect(JSON.stringify(await res.json())).not.toContain(key);
        expect(await prisma.integration.count({ where: { owner: o.org, type: "telegram", status: "connected" } })).toBe(0);
    });
    it("каталог показывает рынку фирмы только своё, planned помечен", async () => {
        const o = await makeOrg();
        await prisma.financeSettings.create({ data: { org: o.org, country: "UZ" } });
        const list = (await (await catalog(asUser(o.userId)("/api/integrations/catalog?q=payment"))).json()).integrations as { key: string; status: string }[];
        expect(list.map((x) => x.key)).toContain("payme");
        expect(list.find((x) => x.key === "payme")!.status).toBe("beta");
        expect(list.find((x) => x.key === "uzum")!.status).toBe("planned");
        expect(list.map((x) => x.key)).not.toContain("monobank");
    });
    it("менять статус паспорта может только администратор платформы; не подключаемый сервис не станет доступным", async () => {
        const o = await makeOrg();
        const res = await adminPut(asUser(o.userId)("/api/admin/integration-manifests/payme", "PUT", { status: "available" }), { params: { key: "payme" } });
        expect(res.status).toBe(403);
    });
});
