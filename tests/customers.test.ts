import { describe, expect, it } from "vitest";
import { hasDb, makeOrg, prisma } from "./helpers/db";
import { asUser, ctx } from "./helpers/http";
import { PATCH as patchContact, DELETE as deleteContact } from "@/app/api/contacts/[id]/route";
import { PATCH as patchCompany } from "@/app/api/companies/[id]/route";
import { DELETE as deleteStage } from "@/app/api/stages/[id]/route";
import { PATCH as patchDeal, DELETE as deleteDeal } from "@/app/api/deals/[id]/route";
import { GET as listDeals } from "@/app/api/deals/route";

const items = [{ description: "Работа", qty: 1, unitPrice: 100, taxRate: 0 }];

async function scene() {
    const { org, userId } = await makeOrg();
    const req = asUser(userId);
    const stage = await prisma.stage.create({ data: { owner: org, name: "Новые", order: 0 } });
    const stage2 = await prisma.stage.create({ data: { owner: org, name: "В работе", order: 1 } });
    const company = await prisma.company.create({ data: { owner: org, name: "Альфа ООО" } });
    const contact = await prisma.contact.create({ data: { owner: org, name: "Иван Петров", firstName: "Иван", lastName: "Петров", company: "Альфа ООО", companyId: company.id } });
    const deal = await prisma.deal.create({ data: { owner: org, stage: stage.id, clientName: "Сделка", order: 0, contact: contact.id, company: company.id, contactName: "Иван Петров", companyName: "Альфа ООО", activities: [] } });
    const draft = await prisma.invoice.create({ data: { org, number: "D-1", customerName: "Иван Петров", contact: contact.id, deal: deal.id, issueDate: "2026-01-01", status: "draft", items: items as never } });
    const sent = await prisma.invoice.create({ data: { org, number: "S-1", customerName: "Иван Петров", contact: contact.id, deal: deal.id, issueDate: "2026-01-01", status: "sent", items: items as never } });
    return { org, userId, req, stage, stage2, company, contact, deal, draft, sent };
}

describe.skipIf(!hasDb)("клиенты: каскад, охрана удаления, этапы", () => {
    it("переименование контакта обновляет сделку и черновики, но не отправленный счёт", async () => {
        const s = await scene();
        const res = await patchContact(s.req(`/api/contacts/${s.contact.id}`, "PATCH", { firstName: "Пётр", lastName: "Иванов" }), ctx(s.contact.id));
        expect(res.status).toBe(200);
        expect((await prisma.deal.findUniqueOrThrow({ where: { id: s.deal.id } })).contactName).toBe("Пётр Иванов");
        expect((await prisma.invoice.findUniqueOrThrow({ where: { id: s.draft.id } })).customerName).toBe("Пётр Иванов");
        expect((await prisma.invoice.findUniqueOrThrow({ where: { id: s.sent.id } })).customerName).toBe("Иван Петров");
        const feed = (await prisma.contact.findUniqueOrThrow({ where: { id: s.contact.id } })).activities as any[];
        expect(feed.some((a) => a.text.startsWith("@@contact_renamed"))).toBe(true);
    });

    it("переименование фирмы обновляет контакты и сделки", async () => {
        const s = await scene();
        await patchCompany(s.req(`/api/companies/${s.company.id}`, "PATCH", { name: "Бета ООО" }), ctx(s.company.id));
        expect((await prisma.contact.findUniqueOrThrow({ where: { id: s.contact.id } })).company).toBe("Бета ООО");
        expect((await prisma.deal.findUniqueOrThrow({ where: { id: s.deal.id } })).companyName).toBe("Бета ООО");
    });

    it("контакт с неоплаченным счётом удалить нельзя", async () => {
        const s = await scene();
        const res = await deleteContact(s.req(`/api/contacts/${s.contact.id}`, "DELETE"), ctx(s.contact.id));
        expect(res.status).toBe(409);
        expect((await res.json()).code).toBe("unpaid_invoices");
        expect(await prisma.contact.count({ where: { id: s.contact.id } })).toBe(1);
    });

    it("с открытой сделкой удаление требует подтверждения и снимает связи, сохраняя имя", async () => {
        const s = await scene();
        await prisma.invoice.update({ where: { id: s.sent.id }, data: { status: "paid" } });
        const first = await deleteContact(s.req(`/api/contacts/${s.contact.id}`, "DELETE"), ctx(s.contact.id));
        expect(first.status).toBe(409);
        expect((await first.json()).code).toBe("has_open_work");
        const forced = await deleteContact(s.req(`/api/contacts/${s.contact.id}?force=1`, "DELETE"), ctx(s.contact.id));
        expect(forced.status).toBe(200);
        const deal = await prisma.deal.findUniqueOrThrow({ where: { id: s.deal.id } });
        expect(deal.contact).toBeNull();
        expect(deal.contactName).toBe("Иван Петров");
        const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: s.draft.id } });
        expect(inv.contact).toBeNull();
        expect(inv.customerName).toBe("Иван Петров");
    });

    it("непустой этап не удаляется без переноса; с переносом сделки сохраняются", async () => {
        const s = await scene();
        const refused = await deleteStage(s.req(`/api/stages/${s.stage.id}`, "DELETE"), ctx(s.stage.id));
        expect(refused.status).toBe(409);
        expect(await prisma.deal.count({ where: { id: s.deal.id } })).toBe(1);
        const ok = await deleteStage(s.req(`/api/stages/${s.stage.id}?moveTo=${s.stage2.id}`, "DELETE"), ctx(s.stage.id));
        expect(ok.status).toBe(200);
        const deal = await prisma.deal.findUniqueOrThrow({ where: { id: s.deal.id } });
        expect(deal.stage).toBe(s.stage2.id);
        expect(await prisma.stage.count({ where: { id: s.stage.id } })).toBe(0);
    });

    it("удаление сделки не оставляет висящих ссылок", async () => {
        const s = await scene();
        const task = await prisma.task.create({ data: { owner: s.org, title: "Позвонить", deal: s.deal.id } });
        const res = await deleteDeal(s.req(`/api/deals/${s.deal.id}`, "DELETE"), ctx(s.deal.id));
        expect(res.status).toBe(200);
        expect((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).deal).toBeNull();
        expect((await prisma.invoice.findUniqueOrThrow({ where: { id: s.draft.id } })).deal).toBeNull();
    });

    it("смена этапа пишется в ленту контакта, выигрыш — в обе ленты", async () => {
        const s = await scene();
        await patchDeal(s.req(`/api/deals/${s.deal.id}`, "PATCH", { stage: s.stage2.id, won: true }), ctx(s.deal.id));
        const contactFeed = (await prisma.contact.findUniqueOrThrow({ where: { id: s.contact.id } })).activities as any[];
        expect(contactFeed.some((a) => a.type === "stage" && a.text.includes("В работе"))).toBe(true);
        expect(contactFeed.some((a) => a.type === "won")).toBe(true);
    });

    it("закрытая сделка не видна обычному сотруднику, но видна ответственному и владельцу", async () => {
        const s = await scene();
        const colleague = await prisma.user.create({ data: { email: `c${Date.now()}@t.local`, firstname: "Анна", lastname: "Смирнова", passwordHash: "x" } });
        await prisma.membership.create({ data: { org: s.org, user: colleague.id, role: "manager" } });
        await prisma.deal.update({ where: { id: s.deal.id }, data: { availableToAll: false } });
        const asColleague = asUser(colleague.id, s.org);
        const list = async (r: typeof asColleague) => (await (await listDeals(r("/api/deals"))).json()) as any[];
        expect((await list(asColleague)).length).toBe(0);
        expect((await list(s.req)).length).toBe(1);
        // назначили ответственным по имени -> стала видна
        await patchDeal(s.req(`/api/deals/${s.deal.id}`, "PATCH", { responsible: "Анна Смирнова" }), ctx(s.deal.id));
        expect((await list(asColleague)).length).toBe(1);
    });
});

describe.skipIf(!hasDb)("закрытая сделка: все маршруты сделки", () => {
    it("лента, документы, сводка и удаление недоступны тем, кто не видит сделку", async () => {
        const { org, userId } = await makeOrg();
        const stage = await prisma.stage.create({ data: { owner: org, name: "S", order: 0 } });
        const deal = await prisma.deal.create({ data: { owner: org, stage: stage.id, clientName: "Секрет", order: 0, availableToAll: false, activities: [] } });
        const colleague = await prisma.user.create({ data: { email: `x${Date.now()}@t.local`, firstname: "Игорь", lastname: "Л", passwordHash: "x" } });
        await prisma.membership.create({ data: { org, user: colleague.id, role: "manager" } });
        const other = asUser(colleague.id, org);
        const mine = asUser(userId);
        const { POST: addNote } = await import("@/app/api/deals/[id]/activities/route");
        const { GET: docs } = await import("@/app/api/deals/[id]/documents/route");
        const { GET: overview } = await import("@/app/api/deals/[id]/overview/route");
        expect((await addNote(other(`/api/deals/${deal.id}/activities`, "POST", { type: "note", text: "x" }), ctx(deal.id))).status).toBe(404);
        expect((await docs(other(`/api/deals/${deal.id}/documents`), ctx(deal.id))).status).toBe(404);
        expect((await overview(other(`/api/deals/${deal.id}/overview`), ctx(deal.id))).status).toBe(404);
        expect((await deleteDeal(other(`/api/deals/${deal.id}`, "DELETE"), ctx(deal.id))).status).toBe(404);
        expect((await addNote(mine(`/api/deals/${deal.id}/activities`, "POST", { type: "note", text: "x" }), ctx(deal.id))).status).toBe(201);
        expect(await prisma.deal.count({ where: { id: deal.id } })).toBe(1);
    });
});
