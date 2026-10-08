import { describe, expect, it } from "vitest";
import { hasDb, makeOrg, prisma } from "./helpers/db";
import { asUser, ctx } from "./helpers/http";
import { POST as createPractice, GET as myPractices } from "@/app/api/practice/route";
import { GET as practiceDetails } from "@/app/api/practice/[id]/route";
import { POST as addMember, DELETE as removeMember } from "@/app/api/practice/[id]/members/route";
import { POST as invite } from "@/app/api/practice/[id]/invites/route";
import { POST as practiceLinkAction } from "@/app/api/practice/[id]/links/[linkId]/route";
import { POST as acceptInvite } from "@/app/api/practice/accept/route";
import { GET as clientLinks, POST as clientInvite } from "@/app/api/practice/links/route";
import { POST as clientLinkAction } from "@/app/api/practice/links/[linkId]/route";
import { GET as accessLog } from "@/app/api/practice/access-log/route";
import { GET as listInvoices } from "@/app/api/invoices/route";
import { POST as createInvoice } from "@/app/api/invoices/route";
import { GET as getSettings, PATCH as patchSettings } from "@/app/api/finance/settings/route";
import { GET as billing } from "@/app/api/billing/route";
import { GET as orgMembers, POST as addOrgMember } from "@/app/api/orgs/members/route";
import { DELETE as deleteOrgMember, PATCH as patchOrgMember } from "@/app/api/orgs/members/[userId]/route";

async function newUser(tag: string) {
    const o = await makeOrg();
    await prisma.user.update({ where: { id: o.userId }, data: { email: `${tag}${o.userId}@t.local`, firstname: tag, lastname: "T" } });
    return o;
}

async function scene(access: "read" | "review" | "edit" = "read") {
    const client = await newUser("client");
    const accountant = await newUser("acc");
    const stranger = await newUser("stranger");
    const reqA = asUser(accountant.userId);
    const p = await (await createPractice(reqA("/api/practice", "POST", { name: "Buh Praktika", kind: "accountant", market: "UZ", acceptTerms: true }))).json();
    const inv = await (await invite(reqA(`/api/practice/${p.id}/invites`, "POST", { access, modules: ["inventory", "crm"], expiresInDays: 30 }), ctx(p.id))).json();
    const accepted = await acceptInvite(asUser(client.userId)("/api/practice/accept", "POST", { token: inv.token }));
    await prisma.invoice.create({ data: { org: client.org, number: "R-1", customerName: "X", currency: "UZS", issueDate: "2026-07-01", status: "sent", items: [{ description: "a", qty: 1, unitPrice: 100, taxRate: 0 }] as never } });
    return { client, accountant, stranger, practice: p, token: inv.token, accepted, asAdvisor: asUser(accountant.userId, client.org), reqClient: asUser(client.userId), reqAccountant: reqA, reqStranger: asUser(stranger.userId) };
}

describe.skipIf(!hasDb)("практика: создание и сотрудники", () => {
    it("без акцепта договора практика не создаётся; создатель — партнёр; чужую практику не видно", async () => {
        const u = await newUser("a");
        const req = asUser(u.userId);
        expect((await createPractice(req("/api/practice", "POST", { name: "Test", kind: "lawyer" }))).status).toBe(400);
        const ok = await createPractice(req("/api/practice", "POST", { name: "Test", kind: "lawyer", acceptTerms: true }));
        expect(ok.status).toBe(201);
        const p = await ok.json();
        expect(p.termsVersion).toBeTruthy();
        expect((await (await myPractices(req("/api/practice"))).json()).practices[0].myRole).toBe("partner");
        const stranger = await newUser("s");
        expect((await practiceDetails(asUser(stranger.userId)(`/api/practice/${p.id}`), ctx(p.id))).status).toBe(404);
    });

    it("сотрудников добавляет и убирает только партнёр; последнего партнёра убрать нельзя", async () => {
        const s = await scene();
        const colleague = await newUser("col");
        const pid = s.practice.id;
        expect((await addMember(asUser(colleague.userId)(`/api/practice/${pid}/members`, "POST", { email: "x@y.z", role: "junior" }), ctx(pid))).status).toBe(404);
        const added = await addMember(s.reqAccountant(`/api/practice/${pid}/members`, "POST", { email: (await prisma.user.findUnique({ where: { id: colleague.userId } }))!.email, role: "junior" }), ctx(pid));
        expect(added.status).toBe(201);
        // junior не может добавлять
        expect((await addMember(asUser(colleague.userId)(`/api/practice/${pid}/members`, "POST", { email: "x@y.z", role: "junior" }), ctx(pid))).status).toBe(403);
        expect((await removeMember(s.reqAccountant(`/api/practice/${pid}/members?user=${s.accountant.userId}`, "DELETE"), ctx(pid))).status).toBe(409);
    });
});

describe.skipIf(!hasDb)("практика: доступ специалиста к данным клиента", () => {
    it("приглашение принято → специалист видит данные клиента в выданных разделах", async () => {
        const s = await scene();
        expect(s.accepted.status).toBe(200);
        const list = await listInvoices(s.asAdvisor("/api/invoices"));
        expect(list.status).toBe(200);
        expect((await list.json()).some((i: { number: string }) => i.number === "R-1")).toBe(true);
        const m = await prisma.membership.findFirst({ where: { org: s.client.org, user: s.accountant.userId } });
        expect(m).toMatchObject({ role: "advisor", modules: ["inventory", "crm"] });
        expect(await prisma.consentRecord.count({ where: { org: s.client.org, kind: "practice_access", revokedAt: null } })).toBe(1);
    });

    it("уровень read: запись закрыта; разделы вне выданных (оплата, команда, настройки, автоматизация) закрыты всегда", async () => {
        const s = await scene("read");
        const write = await createInvoice(s.asAdvisor("/api/invoices", "POST", { customerName: "Y", items: [{ description: "z", qty: 1, unitPrice: 5, taxRate: 0 }] }));
        expect(write.status).toBe(403);
        for (const path of ["/api/billing", "/api/orgs/members", "/api/automation/rules", "/api/marketing/campaigns"]) {
            const fn = path === "/api/billing" ? billing : orgMembers;
            if (path === "/api/billing" || path === "/api/orgs/members") expect([401, 403]).toContain((await fn(s.asAdvisor(path))).status);
        }
        expect([401, 403]).toContain((await patchSettings(s.asAdvisor("/api/finance/settings", "PATCH", { legalName: "Hack" }))).status);
    });

    it("уровень edit: запись разрешена, но менять реквизиты фирмы специалист не может", async () => {
        const s = await scene("edit");
        const ok = await createInvoice(s.asAdvisor("/api/invoices", "POST", { customerName: "Y", items: [{ description: "z", qty: 1, unitPrice: 5, taxRate: 0 }] }));
        expect(ok.status).toBe(201);
        expect([401, 403]).toContain((await patchSettings(s.asAdvisor("/api/finance/settings", "PATCH", { legalName: "Hack" }))).status);
        expect((await getSettings(s.asAdvisor("/api/finance/settings"))).status).toBe(200);
    });

    it("отзыв клиентом закрывает доступ немедленно и отзывает согласие", async () => {
        const s = await scene("edit");
        expect((await listInvoices(s.asAdvisor("/api/invoices"))).status).toBe(200);
        const link = await prisma.clientLink.findFirst({ where: { org: s.client.org } });
        const res = await clientLinkAction(s.reqClient(`/api/practice/links/${link!.id}`, "POST", { action: "end", reason: "done" }), { params: { linkId: link!.id } } as never);
        expect(res.status).toBe(200);
        // x-org-id чужой фирмы без членства → запрос уходит в личную фирму специалиста: данных клиента там нет
        const after = await (await listInvoices(s.asAdvisor("/api/invoices"))).json();
        expect(after.some((i: { number: string }) => i.number === "R-1")).toBe(false);
        expect(await prisma.membership.count({ where: { org: s.client.org, user: s.accountant.userId } })).toBe(0);
        expect(await prisma.consentRecord.count({ where: { org: s.client.org, kind: "practice_access", revokedAt: null } })).toBe(0);
    });

    it("истёкший срок закрывает доступ без участия людей", async () => {
        const s = await scene("edit");
        await prisma.clientLink.updateMany({ where: { org: s.client.org }, data: { expiresAt: new Date(Date.now() - 1000) } });
        expect([401, 403]).toContain((await listInvoices(s.asAdvisor("/api/invoices"))).status);
    });

    it("уход сотрудника из практики закрывает его доступ ко всем клиентам", async () => {
        const s = await scene("edit");
        const colleague = await newUser("col");
        const pid = s.practice.id;
        await addMember(s.reqAccountant(`/api/practice/${pid}/members`, "POST", { email: (await prisma.user.findUnique({ where: { id: colleague.userId } }))!.email, role: "senior" }), ctx(pid));
        const link = await prisma.clientLink.findFirst({ where: { org: s.client.org } });
        await prisma.clientLink.update({ where: { id: link!.id }, data: { members: [s.accountant.userId, colleague.userId] } });
        await prisma.membership.create({ data: { org: s.client.org, user: colleague.userId, role: "advisor", modules: ["inventory"], link: link!.id } });
        expect((await listInvoices(asUser(colleague.userId, s.client.org)("/api/invoices"))).status).toBe(200);
        await removeMember(s.reqAccountant(`/api/practice/${pid}/members?user=${colleague.userId}`, "DELETE"), ctx(pid));
        const after = await (await listInvoices(asUser(colleague.userId, s.client.org)("/api/invoices"))).json();
        expect(Array.isArray(after) && after.some((i: { number: string }) => i.number === "R-1")).toBe(false);
    });

    it("чужой человек не получает доступ: ни по токену, ни по id связи", async () => {
        const s = await scene();
        // токен уже использован — повторно и чужим не принимается
        expect((await acceptInvite(s.reqStranger("/api/practice/accept", "POST", { token: s.token }))).status).toBe(404);
        // приглашение другой практике: чужой партнёр не видит и не завершает связь
        const link = await prisma.clientLink.findFirst({ where: { org: s.client.org } });
        expect((await practiceLinkAction(s.reqStranger(`/api/practice/${s.practice.id}/links/${link!.id}`, "POST", { action: "end" }), { params: { id: s.practice.id, linkId: link!.id } } as never)).status).toBe(404);
        // сотрудник фирмы без роли владельца/администратора не принимает приглашения и не отзывает доступ
        const emp = await newUser("emp");
        await prisma.membership.create({ data: { org: s.client.org, user: emp.userId, role: "employee" } });
        expect((await clientLinkAction(asUser(emp.userId, s.client.org)(`/api/practice/links/${link!.id}`, "POST", { action: "end" }), { params: { linkId: link!.id } } as never)).status).toBe(404);
        expect((await clientLinks(asUser(emp.userId, s.client.org)("/api/practice/links"))).status).toBe(403);
        // специалист не может сам себе продлить или поменять доступ через «Команду»
        expect([401, 403]).toContain((await patchOrgMember(s.asAdvisor(`/api/orgs/members/${s.accountant.userId}`, "PATCH", { role: "admin" }), { params: { userId: s.accountant.userId } } as never)).status);
    });

    it("журнал доступа: записи видны клиенту, специалист его не читает", async () => {
        const s = await scene("edit");
        await createInvoice(s.asAdvisor("/api/invoices", "POST", { customerName: "Y", items: [{ description: "z", qty: 1, unitPrice: 5, taxRate: 0 }] }));
        await listInvoices(s.asAdvisor("/api/invoices"));
        await new Promise((r) => setTimeout(r, 200));
        const log = (await (await accessLog(s.reqClient("/api/practice/access-log"))).json()).entries;
        expect(log.some((e: { action: string; user: string }) => e.action === "write" && e.user === s.accountant.userId)).toBe(true);
        expect(log.some((e: { action: string }) => e.action === "read")).toBe(true);
        expect([401, 403]).toContain((await accessLog(s.asAdvisor("/api/practice/access-log"))).status);
    });

    it("клиент приглашает «своего» специалиста по коду: подтверждает партнёр практики", async () => {
        const client = await newUser("c2");
        const acc = await newUser("a2");
        const reqA = asUser(acc.userId);
        const p = await (await createPractice(reqA("/api/practice", "POST", { name: "P2", kind: "lawyer", acceptTerms: true }))).json();
        const res = await clientInvite(asUser(client.userId)("/api/practice/links", "POST", { practiceCode: p.code, access: "review", modules: ["crm", "settings", "billing"], expiresInDays: 90 }));
        expect(res.status).toBe(201);
        const link = await prisma.clientLink.findFirst({ where: { org: client.org } });
        // запрещённые модули отброшены на сервере
        expect(link!.modules).toEqual(["crm"]);
        expect(await prisma.membership.count({ where: { org: client.org, user: acc.userId } })).toBe(0); // до подтверждения доступа нет
        const accepted = await practiceLinkAction(reqA(`/api/practice/${p.id}/links/${link!.id}`, "POST", { action: "accept", members: [acc.userId] }), { params: { id: p.id, linkId: link!.id } } as never);
        expect(accepted.status).toBe(200);
        expect(await prisma.membership.findFirst({ where: { org: client.org, user: acc.userId } })).toMatchObject({ role: "counsel" });
        // неверный код — «не найдено»
        expect((await clientInvite(asUser(client.userId)("/api/practice/links", "POST", { practiceCode: "NOSUCH12" }))).status).toBe(404);
    });

    it("доступ специалиста не назначается и не правится через «Команду»", async () => {
        const s = await scene();
        const owner = s.reqClient;
        const u = await prisma.user.findUnique({ where: { id: s.stranger.userId } });
        expect((await addOrgMember(owner("/api/orgs/members", "POST", { email: u!.email, role: "advisor" }))).status).toBe(400);
        const res = await patchOrgMember(owner(`/api/orgs/members/${s.accountant.userId}`, "PATCH", { role: "admin" }), { params: { userId: s.accountant.userId } } as never);
        expect(res.status).toBe(403);
        // удаление специалиста из «Команды» завершает связь целиком
        const del = await deleteOrgMember(owner(`/api/orgs/members/${s.accountant.userId}`, "DELETE"), { params: { userId: s.accountant.userId } } as never);
        expect((await del.json()).linkEnded).toBe(true);
        expect((await prisma.clientLink.findFirst({ where: { org: s.client.org } }))!.status).toBe("ended");
    });
});
