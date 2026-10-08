import { describe, expect, it } from "vitest";
import { hasDb, makeOrg, prisma } from "./helpers/db";
import { asUser, ctx } from "./helpers/http";
import { POST as createPractice } from "@/app/api/practice/route";
import { POST as invite } from "@/app/api/practice/[id]/invites/route";
import { GET as subprocessors } from "@/app/api/practice/[id]/subprocessors/route";
import { GET as listComments, POST as addComment } from "@/app/api/review/comments/route";
import { setPracticeTerms, practiceTerms, DEFAULT_TERMS } from "@/lib/practice/terms";

describe.skipIf(!hasDb)("условия практики, субподрядчики, комментарии", () => {
    it("по умолчанию ограничение выключено; включённое — бесплатно до N клиентов, дальше нужна подписка", async () => {
        await prisma.platformSettings.deleteMany({ where: { key: "practiceTerms" } });
        expect(await practiceTerms()).toEqual(DEFAULT_TERMS);
        const u = await makeOrg();
        const req = asUser(u.userId);
        const p = await (await createPractice(req("/api/practice", "POST", { name: "Practice A", kind: "accountant", acceptTerms: true }))).json();
        for (let i = 0; i < 5; i++) expect((await invite(req(`/api/practice/${p.id}/invites`, "POST", {}), ctx(p.id))).status).toBe(201);
        await setPracticeTerms({ enforce: true, freeClients: 5 });
        expect((await invite(req(`/api/practice/${p.id}/invites`, "POST", {}), ctx(p.id))).status).toBe(402);
        await prisma.practice.update({ where: { id: p.id }, data: { paidUntil: new Date(Date.now() + 86400000) } });
        expect((await invite(req(`/api/practice/${p.id}/invites`, "POST", {}), ctx(p.id))).status).toBe(201);
        await prisma.platformSettings.deleteMany({ where: { key: "practiceTerms" } });
    });
    it("журнал субподрядчиков виден только участникам практики", async () => {
        const u = await makeOrg(), stranger = await makeOrg();
        const p = await (await createPractice(asUser(u.userId)("/api/practice", "POST", { name: "Practice B", acceptTerms: true }))).json();
        await prisma.subprocessor.create({ data: { name: "Hosting Co", purpose: "hosting" } });
        const ok = await subprocessors(asUser(u.userId)(`/api/practice/${p.id}/subprocessors`), ctx(p.id));
        expect(ok.status).toBe(200);
        expect(JSON.stringify(await ok.json())).toContain("Hosting Co");
        expect((await subprocessors(asUser(stranger.userId)(`/api/practice/${p.id}/subprocessors`), ctx(p.id))).status).toBe(404);
    });
    it("комментарий с упоминанием: уведомление только участнику той же фирмы; чужой документ недоступен", async () => {
        const o = await makeOrg(), other = await makeOrg(), mate = await makeOrg();
        await prisma.membership.create({ data: { org: o.org, user: mate.userId, role: "employee" } });
        const inv = await prisma.invoice.create({ data: { org: o.org, number: "C-1", customerName: "X", issueDate: "2026-01-01" } });
        const req = asUser(o.userId);
        const res = await addComment(req("/api/review/comments", "POST", { kind: "invoices", id: inv.id, text: "check VAT", mentions: [mate.userId, other.userId] }));
        expect(res.status).toBe(201);
        const c = await res.json();
        expect(c.mentions).toEqual([mate.userId]);
        expect(await prisma.notification.count({ where: { org: o.org, user: mate.userId, type: "mention" } })).toBe(1);
        expect(await prisma.notification.count({ where: { user: other.userId, type: "mention" } })).toBe(0);
        const list = await (await listComments(req(`/api/review/comments?kind=invoices&id=${inv.id}`))).json();
        expect(list.comments).toHaveLength(1);
        expect(list.people.length).toBeGreaterThan(1);
        expect((await listComments(asUser(other.userId)(`/api/review/comments?kind=invoices&id=${inv.id}`))).status).toBe(404);
        expect((await addComment(req("/api/review/comments", "POST", { kind: "invoices", id: inv.id, text: "  " }))).status).toBe(400);
    });
});
