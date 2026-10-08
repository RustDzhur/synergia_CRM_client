import { describe, expect, it } from "vitest";
import { hasDb, makeOrg, prisma } from "./helpers/db";
import { asUser, ctx } from "./helpers/http";
import { categoryFor } from "@/lib/review/rules";
import { bankProvider, bankProviders, syncAccount, syncAll, BankSyncError } from "@/lib/banks/provider";
import { importBankRows } from "@/lib/finance/bankImport";
import { POST as createRule, GET as listRules } from "@/app/api/review/rules/route";
import { DELETE as deleteRule } from "@/app/api/review/rules/[id]/route";
import { POST as syncRoute } from "@/app/api/bank/sync/route";
import { POST as periods } from "@/app/api/review/periods/route";

describe("правила сверки (чистая логика)", () => {
    const rules = [{ id: "1", field: "counterparty", pattern: "Nova Poshta", category: "Delivery" }, { id: "2", field: "reference", pattern: "аренда", category: "Rent" }];
    it("подбирает по контрагенту и по назначению без учёта регистра; первое подходящее; иначе null", () => {
        expect(categoryFor(rules, { counterparty: "NOVA POSHTA LLC", reference: "" })?.category).toBe("Delivery");
        expect(categoryFor(rules, { counterparty: "ТОВ", reference: "Оплата: аренда офиса" })?.category).toBe("Rent");
        expect(categoryFor(rules, { counterparty: "X", reference: "Y" })).toBeNull();
    });
});

describe("банки: единый интерфейс", () => {
    it("реестр содержит monobank и privatbank с возможностями", () => {
        expect(bankProviders().map((p) => p.id).sort()).toEqual(["monobank", "privatbank"]);
        expect(bankProvider("monobank")?.capabilities.statement).toBe(true);
        expect(bankProvider("privatbank")?.capabilities.balance).toBe(true);
        expect(bankProvider("nope")).toBeNull();
    });
});

describe.skipIf(!hasDb)("правила и синхронизация на базе", () => {
    it("правило применяется к существующим и новым строкам; чужая фирма не видит; закрытый период не переписывается", async () => {
        const o = await makeOrg(), other = await makeOrg();
        const acc = await prisma.bankAccount.create({ data: { org: o.org, name: "A", kind: "bank" } });
        const old = await prisma.bankTransaction.create({ data: { org: o.org, account: acc.id, date: "2026-02-10", amount: -50, counterparty: "NOVA POSHTA" } });
        const locked = await prisma.bankTransaction.create({ data: { org: o.org, account: acc.id, date: "2026-01-10", amount: -20, counterparty: "NOVA POSHTA" } });
        const req = asUser(o.userId);
        await periods(req("/api/review/periods", "POST", { action: "close", from: "2026-01-01", to: "2026-01-31", acknowledge: true }));
        const res = await createRule(req("/api/review/rules", "POST", { field: "counterparty", pattern: "nova poshta", category: "Delivery" }));
        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.applied).toBe(1);
        expect((await prisma.bankTransaction.findUnique({ where: { id: old.id } }))!.category).toBe("Delivery");
        expect((await prisma.bankTransaction.findUnique({ where: { id: locked.id } }))!.category).toBe("");
        // новая выписка размечается правилом
        const r = await importBankRows(o.org, { id: acc.id, currency: "UAH" }, [{ date: "2026-03-01", amount: -10, counterparty: "Nova Poshta", reference: "", externalId: "x1" }], "import");
        expect((r.created[0] as { category: string }).category).toBe("Delivery");
        expect((await prisma.practiceRule.findUnique({ where: { id: body.rule.id } }))!.hits).toBeGreaterThanOrEqual(2);
        // чужая фирма: правил не видит и удалить не может
        expect((await (await listRules(asUser(other.userId)("/api/review/rules"))).json()).rules).toHaveLength(0);
        expect((await deleteRule(asUser(other.userId)(`/api/review/rules/${body.rule.id}`, "DELETE"), ctx(body.rule.id))).status).toBe(404);
        expect((await deleteRule(req(`/api/review/rules/${body.rule.id}`, "DELETE"), ctx(body.rule.id))).status).toBe(200);
        // слишком короткий шаблон
        expect((await createRule(req("/api/review/rules", "POST", { pattern: "ab", category: "X" }))).status).toBe(400);
    });
    it("синхронизация: счёт без ключей даёт понятную ошибку, «обновить всё» не падает; ручной счёт пропускается", async () => {
        const o = await makeOrg();
        const manual = await prisma.bankAccount.create({ data: { org: o.org, name: "M", kind: "cash" } });
        const linked = await prisma.bankAccount.create({ data: { org: o.org, name: "B", kind: "bank", provider: "monobank", providerAccountId: "a1", providerSecret: "" } });
        await expect(syncAccount(o.org, { ...linked })).rejects.toBeInstanceOf(BankSyncError);
        const out = await syncAll(o.org);
        expect(out).toHaveLength(1);
        expect(out[0]).toMatchObject({ account: linked.id, ok: false });
        expect(out.find((x) => x.account === manual.id)).toBeUndefined();
        expect((await syncRoute(asUser(o.userId)("/api/bank/sync", "POST"))).status).toBe(200);
    });
});
