import { describe, expect, it } from "vitest";
import { hasDb, makeOrg, prisma } from "./helpers/db";
import { asUser, ctx } from "./helpers/http";
import { diffLines, fillTemplate, templateVars } from "@/lib/legal/diff";
import { POST as createDocRoute, GET as listDocsRoute } from "@/app/api/legal/docs/route";
import { GET as getDocRoute, PATCH as patchDoc } from "@/app/api/legal/docs/[id]/route";
import { POST as addVersionRoute } from "@/app/api/legal/docs/[id]/versions/route";
import { GET as diffRoute } from "@/app/api/legal/docs/[id]/diff/route";
import { POST as createTpl } from "@/app/api/legal/templates/route";
import { POST as fromTpl } from "@/app/api/legal/templates/[id]/route";
import { POST as proposeBatch, GET as listBatches } from "@/app/api/review/batches/route";
import { POST as batchAction, GET as batchReport } from "@/app/api/review/batches/[id]/route";
import { POST as createRule } from "@/app/api/review/rules/route";
import { POST as periods } from "@/app/api/review/periods/route";

describe("сравнение версий и шаблоны", () => {
    it("diff показывает добавленные и удалённые строки; переменные шаблона находятся и подставляются", () => {
        const d = diffLines("a\nb\nc", "a\nc\nd");
        expect(d.filter((x) => x.type === "del").map((x) => x.text)).toEqual(["b"]);
        expect(d.filter((x) => x.type === "add").map((x) => x.text)).toEqual(["d"]);
        expect(templateVars("Hi {{ name }}, {{name}} and {{city}}")).toEqual(["name", "city"]);
        expect(fillTemplate("Hi {{name}} {{x}}", { name: "Ann" })).toBe("Hi Ann {{x}}");
    });
});

describe.skipIf(!hasDb)("хранилище договоров", () => {
    it("версии, статусы, срок → событие календаря, чек-лист, сравнение, изоляция фирм, метка ИИ", async () => {
        const o = await makeOrg(), other = await makeOrg();
        const req = asUser(o.userId);
        const res = await createDocRoute(req("/api/legal/docs", "POST", { title: "Supply", counterparty: "ACME", body: "1. Price\n2. Term", dueDate: "2026-12-31" }));
        expect(res.status).toBe(201);
        const doc = await res.json();
        expect(await prisma.event.count({ where: { org: o.org, source: "legal", date: "2026-12-31" } })).toBe(1);
        // новая версия; без изменений нельзя; ИИ-метка
        expect((await addVersionRoute(req(`/api/legal/docs/${doc.id}/versions`, "POST", { body: "1. Price\n2. Term" }), ctx(doc.id))).status).toBe(409);
        expect((await addVersionRoute(req(`/api/legal/docs/${doc.id}/versions`, "POST", { body: "1. Price\n2. Term 12 months", aiDraft: true }), ctx(doc.id))).status).toBe(201);
        const got = await (await getDocRoute(req(`/api/legal/docs/${doc.id}`), ctx(doc.id))).json();
        expect(got.versions.map((v: { n: number; aiDraft: boolean }) => [v.n, v.aiDraft])).toEqual([[2, true], [1, false]]);
        const diff = await (await diffRoute(req(`/api/legal/docs/${doc.id}/diff?a=1&b=2`), ctx(doc.id))).json();
        expect(diff.lines.some((l: { type: string; text: string }) => l.type === "add" && l.text.includes("12 months"))).toBe(true);
        // статусы: нельзя перепрыгнуть, подписанное не возвращается
        expect((await patchDoc(req(`/api/legal/docs/${doc.id}`, "PATCH", { status: "signed" }), ctx(doc.id))).status).toBe(409);
        for (const st of ["in_review", "approved", "signed"]) expect((await patchDoc(req(`/api/legal/docs/${doc.id}`, "PATCH", { status: st }), ctx(doc.id))).status).toBe(200);
        expect((await addVersionRoute(req(`/api/legal/docs/${doc.id}/versions`, "POST", { body: "new" }), ctx(doc.id))).status).toBe(409);
        expect((await patchDoc(req(`/api/legal/docs/${doc.id}`, "PATCH", { status: "draft" }), ctx(doc.id))).status).toBe(409);
        // чек-лист хранит только известные пункты
        const cl = await (await patchDoc(req(`/api/legal/docs/${doc.id}`, "PATCH", { checklist: { parties: true, hack: true } }), ctx(doc.id))).json();
        expect(cl.checklist).toMatchObject({ parties: true, subject: false });
        expect(cl.checklist.hack).toBeUndefined();
        // срок сменили — событие переехало, убрали — исчезло
        await patchDoc(req(`/api/legal/docs/${doc.id}`, "PATCH", { dueDate: "2027-01-15" }), ctx(doc.id));
        expect(await prisma.event.count({ where: { org: o.org, source: "legal" } })).toBe(1);
        await patchDoc(req(`/api/legal/docs/${doc.id}`, "PATCH", { dueDate: "" }), ctx(doc.id));
        expect(await prisma.event.count({ where: { org: o.org, source: "legal" } })).toBe(0);
        // чужая фирма ничего не видит
        const oreq = asUser(other.userId);
        expect((await getDocRoute(oreq(`/api/legal/docs/${doc.id}`), ctx(doc.id))).status).toBe(404);
        expect((await diffRoute(oreq(`/api/legal/docs/${doc.id}/diff?a=1&b=2`), ctx(doc.id))).status).toBe(404);
        expect((await (await listDocsRoute(oreq("/api/legal/docs"))).json()).docs).toHaveLength(0);
    });
    it("шаблон с переменными → документ", async () => {
        const o = await makeOrg();
        const req = asUser(o.userId);
        const tpl = await (await createTpl(req("/api/legal/templates", "POST", { name: "NDA", body: "NDA between {{us}} and {{them}}" }))).json();
        const doc = await (await fromTpl(req(`/api/legal/templates/${tpl.id}`, "POST", { values: { us: "A", them: "B" } }), ctx(tpl.id))).json();
        const v = await prisma.legalDocVersion.findFirst({ where: { doc: doc.id } });
        expect(v!.body).toBe("NDA between A and B");
    });
});

describe.skipIf(!hasDb)("пакеты по правилам: предложить → применить → откатить", () => {
    it("предложение ничего не пишет; применение пишет; откат возвращает; ручная правка не затирается; закрытый период пропускается", async () => {
        const o = await makeOrg(), other = await makeOrg();
        const req = asUser(o.userId);
        const acc = await prisma.bankAccount.create({ data: { org: o.org, name: "A", kind: "bank" } });
        expect((await proposeBatch(req("/api/review/batches", "POST"))).status).toBe(400); // правил нет
        await createRule(req("/api/review/rules", "POST", { pattern: "zzz-nothing", category: "X" }));
        const t1 = await prisma.bankTransaction.create({ data: { org: o.org, account: acc.id, date: "2026-02-10", amount: -5, counterparty: "NOVA POSHTA" } });
        const t2 = await prisma.bankTransaction.create({ data: { org: o.org, account: acc.id, date: "2026-02-11", amount: -6, counterparty: "NOVA POSHTA" } });
        const t3 = await prisma.bankTransaction.create({ data: { org: o.org, account: acc.id, date: "2026-01-11", amount: -7, counterparty: "NOVA POSHTA" } });
        await prisma.practiceRule.create({ data: { org: o.org, field: "counterparty", pattern: "nova", category: "Delivery", createdBy: o.userId } });
        const p = await proposeBatch(req("/api/review/batches", "POST"));
        expect(p.status).toBe(201);
        const { id, count } = await p.json();
        expect(count).toBe(3);
        expect((await prisma.bankTransaction.findUnique({ where: { id: t1.id } }))!.category).toBe(""); // ничего не записано
        // закрыли январь после предложения
        await periods(req("/api/review/periods", "POST", { action: "close", from: "2026-01-01", to: "2026-01-31", acknowledge: true }));
        // t2 человек поправил сам
        await prisma.bankTransaction.update({ where: { id: t2.id }, data: { category: "Manual" } });
        const ap = await (await batchAction(req(`/api/review/batches/${id}`, "POST", { action: "apply" }), ctx(id))).json();
        expect(ap).toMatchObject({ status: "applied", skipped: 2 });
        expect((await prisma.bankTransaction.findUnique({ where: { id: t1.id } }))!.category).toBe("Delivery");
        expect((await prisma.bankTransaction.findUnique({ where: { id: t2.id } }))!.category).toBe("Manual");
        expect((await prisma.bankTransaction.findUnique({ where: { id: t3.id } }))!.category).toBe("");
        expect((await batchAction(req(`/api/review/batches/${id}`, "POST", { action: "apply" }), ctx(id))).status).toBe(409);
        // отчёт и список
        expect((await (await batchReport(req(`/api/review/batches/${id}`), ctx(id))).json()).changes).toHaveLength(1);
        expect((await (await listBatches(req("/api/review/batches"))).json()).batches).toHaveLength(1);
        // чужая фирма не видит и не применяет
        expect((await batchReport(asUser(other.userId)(`/api/review/batches/${id}`), ctx(id))).status).toBe(404);
        expect((await batchAction(asUser(other.userId)(`/api/review/batches/${id}`, "POST", { action: "rollback" }), ctx(id))).status).toBe(404);
        // откат
        const rb = await (await batchAction(req(`/api/review/batches/${id}`, "POST", { action: "rollback" }), ctx(id))).json();
        expect(rb).toMatchObject({ status: "rolled_back", restored: 1 });
        expect((await prisma.bankTransaction.findUnique({ where: { id: t1.id } }))!.category).toBe("");
    });
});
