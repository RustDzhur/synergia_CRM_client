import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { hasDb, makeOrg, prisma } from "./helpers/db";
import { asUser, ctx } from "./helpers/http";
import { POST as periods, GET as listPeriods } from "@/app/api/review/periods/route";
import { POST as createInvoice } from "@/app/api/invoices/route";
import { PATCH as patchInvoice, DELETE as deleteInvoice } from "@/app/api/invoices/[id]/route";
import { POST as createExpense } from "@/app/api/expenses/route";
import { DELETE as deleteExpense } from "@/app/api/expenses/[id]/route";
import { PATCH as markEsf } from "@/app/api/invoices/[id]/esf/route";
import { PATCH as setReviewRoute } from "@/app/api/review/[kind]/[id]/route";
import { POST as bulk } from "@/app/api/review/bulk/route";
import { POST as createRequest, GET as listRequests } from "@/app/api/review/requests/route";
import { PATCH as answerRequest } from "@/app/api/review/requests/[id]/route";
import { GET as queue } from "@/app/api/review/queue/route";
import { registerPayment } from "@/lib/sync/payments";

const today = new Date().toISOString().slice(0, 10);
const items = [{ description: "a", qty: 1, unitPrice: 100, taxRate: 0 }];

async function scene() {
    const o = await makeOrg();
    const inv = await prisma.invoice.create({ data: { org: o.org, number: "P-1", customerName: "X", currency: "UZS", issueDate: "2026-03-10", status: "sent", items: items as never } });
    const draft = await prisma.invoice.create({ data: { org: o.org, number: "P-2", customerName: "X", currency: "UZS", issueDate: "2026-03-12", status: "draft", items: items as never } });
    const exp = await prisma.expense.create({ data: { org: o.org, vendor: "V", amount: 50, currency: "UZS", date: "2026-03-15" } });
    return { ...o, inv, draft, exp, req: asUser(o.userId) };
}
const close = (s: { req: ReturnType<typeof asUser> }, extra: object = {}) => periods(s.req("/api/review/periods", "POST", { action: "close", from: "2026-03-01", to: "2026-03-31", acknowledge: true, ...extra }));

describe.skipIf(!hasDb)("закрытие периода: сервер не даёт править закрытое", () => {
    it("закрытый период: нельзя создать, изменить, удалить счёт и расход с датой внутри периода (423)", async () => {
        const s = await scene();
        expect((await close(s)).status).toBe(201);
        // новый счёт и расход в закрытом периоде
        const body = (issueDate: string) => ({ customerName: "N", items, issueDate });
        await prisma.invoice.count(); // прогрев
        // счёт создаётся «сегодня» — сегодня в открытом периоде: можно
        expect((await createInvoice(s.req("/api/invoices", "POST", body(today)))).status).toBe(201);
        // правка суммы и удаление существующих
        expect((await patchInvoice(s.req(`/api/invoices/${s.draft.id}`, "PATCH", { notes: "x" }), ctx(s.draft.id))).status).toBe(423);
        expect((await deleteInvoice(s.req(`/api/invoices/${s.draft.id}`, "DELETE"), ctx(s.draft.id))).status).toBe(423);
        expect((await deleteExpense(s.req(`/api/expenses/${s.exp.id}`, "DELETE"), ctx(s.exp.id))).status).toBe(423);
        expect((await createExpense(s.req("/api/expenses", "POST", { vendor: "N", amount: 5, date: "2026-03-20" }))).status).toBe(423);
        expect(await prisma.expense.count({ where: { id: s.exp.id } })).toBe(1);
        // за пределами периода — можно
        expect((await createExpense(s.req("/api/expenses", "POST", { vendor: "N", amount: 5, date: "2026-04-02" }))).status).toBe(201);
    });

    it("отметки, не меняющие учёт, разрешены в закрытом периоде", async () => {
        const s = await scene();
        await prisma.financeSettings.create({ data: { org: s.org, country: "UZ" } });
        await close(s);
        expect((await markEsf(s.req(`/api/invoices/${s.inv.id}/esf`, "PATCH", { status: "prepared" }), ctx(s.inv.id))).status).toBe(200);
        expect((await setReviewRoute(s.req(`/api/review/invoices/${s.inv.id}`, "PATCH", { status: "needs_review" }), { params: { kind: "invoices", id: s.inv.id } } as never)).status).toBe(200);
    });

    it("платёж по старому счёту в открытом периоде проводится, в закрытом — отклоняется", async () => {
        const s = await scene();
        await close(s);
        const ok = await registerPayment(s.org, s.inv.id, { source: "manual", externalId: "p1", amount: 40, paidAt: new Date(`${today}T10:00:00Z`) });
        expect(ok.ok && ok.applied).toBe(40);
        await expect(registerPayment(s.org, s.inv.id, { source: "manual", externalId: "p2", amount: 10, paidAt: new Date("2026-03-20T10:00:00Z") })).rejects.toThrow(/closed/);
        // сам счёт: дата и строки не изменились
        const after = await prisma.invoice.findUnique({ where: { id: s.inv.id } });
        expect(after?.issueDate).toBe("2026-03-10");
        expect(after?.paidAmount).toBe(40);
    });

    it("чек-лист: пока есть блокирующие хвосты, закрытие требует подтверждения; пересекающиеся периоды не закрываются", async () => {
        const s = await scene();
        const refused = await close(s, { acknowledge: false });
        expect(refused.status).toBe(409);
        const body = await refused.json();
        expect(body.checklist.map((i: { code: string }) => i.code)).toContain("draft_invoices");
        expect((await close(s)).status).toBe(201);
        expect((await periods(s.req("/api/review/periods", "POST", { action: "close", from: "2026-03-15", to: "2026-04-15", acknowledge: true }))).status).toBe(409);
    });

    it("повторное открытие требует причину, записывается и возвращает возможность правки", async () => {
        const s = await scene();
        const lock = (await (await close(s)).json()).lock;
        expect((await periods(s.req("/api/review/periods", "POST", { action: "reopen", id: lock.id, reason: "" }))).status).toBe(400);
        expect((await periods(s.req("/api/review/periods", "POST", { action: "reopen", id: lock.id, reason: "forgot an invoice" }))).status).toBe(200);
        expect((await patchInvoice(s.req(`/api/invoices/${s.draft.id}`, "PATCH", { notes: "ok" }), ctx(s.draft.id))).status).toBe(200);
        const list = (await (await listPeriods(s.req("/api/review/periods"))).json()).periods;
        expect(list[0].reopenReason).toContain("forgot an invoice");
    });

    it("закрывать и открывать период могут владелец, администратор и специалист; сотрудник — нет", async () => {
        const s = await scene();
        const emp = await makeOrg();
        await prisma.membership.create({ data: { org: s.org, user: emp.userId, role: "manager" } });
        const res = await periods(asUser(emp.userId, s.org)("/api/review/periods", "POST", { action: "close", from: "2026-03-01", to: "2026-03-31", acknowledge: true }));
        expect(res.status).toBe(403);
    });
});

describe.skipIf(!hasDb)("проверка документов и запросы клиенту", () => {
    it("отправка на проверку любым, одобрение — только владельцем/администратором/специалистом; пакетное одобрение трогает только «на проверке»", async () => {
        const s = await scene();
        const mgr = await makeOrg();
        await prisma.membership.create({ data: { org: s.org, user: mgr.userId, role: "manager" } });
        const asMgr = asUser(mgr.userId, s.org);
        const p = (id: string) => ({ params: { kind: "invoices", id } }) as never;
        expect((await setReviewRoute(asMgr(`/api/review/invoices/${s.inv.id}`, "PATCH", { status: "needs_review" }), p(s.inv.id))).status).toBe(200);
        expect((await setReviewRoute(asMgr(`/api/review/invoices/${s.inv.id}`, "PATCH", { status: "approved" }), p(s.inv.id))).status).toBe(403);
        const q = (await (await queue(s.req("/api/review/queue?kind=invoices"))).json()).items;
        expect(q.map((i: { id: string }) => i.id)).toEqual([s.inv.id]);
        const r = await (await bulk(s.req("/api/review/bulk", "POST", { kind: "invoices", ids: [s.inv.id, s.draft.id, "nope"] }))).json();
        expect(r).toEqual({ approved: 1, skipped: 2 });
        // чужой документ не одобряется
        const other = await makeOrg();
        const foreign = await prisma.invoice.create({ data: { org: other.org, number: "F-1", customerName: "Y", currency: "UZS", issueDate: today, status: "sent", items: items as never, review: { status: "needs_review" } } });
        expect((await setReviewRoute(s.req(`/api/review/invoices/${foreign.id}`, "PATCH", { status: "approved" }), p(foreign.id))).status).toBe(404);
    });

    it("запрос клиенту: специалист создаёт, клиент отвечает, чужая фирма не видит", async () => {
        const s = await scene();
        const acc = await makeOrg();
        const link = await prisma.clientLink.create({ data: { practice: "pr", org: s.org, status: "active", token: `t${Date.now()}${Math.random()}`, access: "review", modules: ["inventory"], members: [acc.userId], expiresAt: new Date(Date.now() + 86400_000) } });
        const practice = await prisma.practice.create({ data: { name: "P", kind: "accountant", code: `C${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`.slice(0, 12), ownerUser: acc.userId, termsAcceptedAt: new Date(), termsVersion: "t" } });
        await prisma.clientLink.update({ where: { id: link.id }, data: { practice: practice.id } });
        await prisma.practiceMember.create({ data: { practice: practice.id, user: acc.userId, role: "partner" } });
        await prisma.membership.create({ data: { org: s.org, user: acc.userId, role: "advisor", modules: ["inventory"], link: link.id } });
        const asAdvisor = asUser(acc.userId, s.org);
        const made = await createRequest(asAdvisor("/api/review/requests", "POST", { subject: "Send the receipt for V", entityType: "expense", entityId: s.exp.id }));
        expect(made.status).toBe(201);
        const id = (await made.json()).id;
        expect(await prisma.notification.count({ where: { org: s.org, type: "client_request" } })).toBe(1);
        const open = (await (await listRequests(s.req("/api/review/requests?status=open"))).json()).requests;
        expect(open).toHaveLength(1);
        expect((await answerRequest(s.req(`/api/review/requests/${id}`, "PATCH", { answer: "Here it is" }), ctx(id))).status).toBe(200);
        expect((await answerRequest(s.req(`/api/review/requests/${id}`, "PATCH", { answer: "again" }), ctx(id))).status).toBe(409);
        const stranger = await makeOrg();
        expect((await (await listRequests(asUser(stranger.userId)("/api/review/requests"))).json()).requests).toHaveLength(0);
        // сотрудник клиента без права на проверку запросы не создаёт
        const mgr = await makeOrg();
        await prisma.membership.create({ data: { org: s.org, user: mgr.userId, role: "manager" } });
        expect((await createRequest(asUser(mgr.userId, s.org)("/api/review/requests", "POST", { subject: "hello there" }))).status).toBe(403);
    });
});

// Каждый маршрут записи счетов, расходов и банковских операций обязан отвечать 423 на закрытый период, а не «Server error»:
// либо обёрнут в withPeriodLock, либо входит в список ниже с причиной (меняет только отметки, которые разрешены в закрытом периоде).
describe("покрытие закрытых периодов", () => {
    const ALLOW: Record<string, string> = {
        "app/api/invoices/[id]/esf/route.ts": "отметка ЭСФ — поле esf разрешено в закрытом периоде",
        "app/api/invoices/[id]/fiscal/route.ts": "служебные данные фискального чека",
        "app/api/invoices/[id]/payment-link/route.ts": "ссылка на оплату",
        "app/api/bank/accounts/route.ts": "счета и кассы, не операции",
    };
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith("route.ts") ? [p] : []; });
    it("новый маршрут записи финансовых сущностей не появляется без обработки закрытого периода", () => {
        const root = join(__dirname, "..");
        const offenders = walk(join(root, "app/api")).map((p) => p.slice(root.length + 1)).filter((rel) => {
            const src = readFileSync(join(root, rel), "utf8");
            const writes = /prisma\.(invoice|expense|bankTransaction)\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\b/.test(src);
            return writes && !src.includes("withPeriodLock") && !ALLOW[rel];
        });
        expect(offenders).toEqual([]);
    });
});
