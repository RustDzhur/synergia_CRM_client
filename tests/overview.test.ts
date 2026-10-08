import { describe, expect, it } from "vitest";
import { hasDb, makeOrg, prisma } from "./helpers/db";
import { asUser, ctx } from "./helpers/http";
import { GET as contactOverview } from "@/app/api/contacts/[id]/overview/route";
import { GET as dealOverview } from "@/app/api/deals/[id]/overview/route";
import { GET as companyDocs } from "@/app/api/companies/[id]/documents/route";
import { GET as notifications } from "@/app/api/notifications/route";
import { registerPayment } from "@/lib/sync/payments";

const items = [{ description: "Работа", qty: 1, unitPrice: 100, taxRate: 0 }];

describe.skipIf(!hasDb)("сводка клиента и сделки", () => {
    it("считает выставлено, оплачено, остаток, расходы и маржу по валютам", async () => {
        const { org, userId } = await makeOrg();
        const req = asUser(userId);
        const stage = await prisma.stage.create({ data: { owner: org, name: "S", order: 0 } });
        const company = await prisma.company.create({ data: { owner: org, name: "Фирма" } });
        const contact = await prisma.contact.create({ data: { owner: org, name: "Клиент", companyId: company.id } });
        const deal = await prisma.deal.create({ data: { owner: org, stage: stage.id, clientName: "Сделка", order: 0, contact: contact.id, company: company.id, activities: [] } });
        const a = await prisma.invoice.create({ data: { org, number: "A", customerName: "К", issueDate: "2026-01-01", status: "sent", deal: deal.id, contact: contact.id, company: company.id, items: items as never } });
        await prisma.invoice.create({ data: { org, number: "B", customerName: "К", issueDate: "2026-01-02", status: "sent", deal: deal.id, contact: contact.id, company: company.id, items: items as never, dueDate: "2020-01-01" } });
        await prisma.invoice.create({ data: { org, number: "C", customerName: "К", issueDate: "2026-01-03", status: "draft", deal: deal.id, contact: contact.id, items: items as never } });
        await registerPayment(org, a.id, { amount: 40, source: "manual", externalId: "p1" });
        await prisma.expense.create({ data: { org, vendor: "Поставщик", amount: 30, date: "2026-01-05", deal: deal.id } });
        await prisma.task.create({ data: { owner: org, title: "Звонок", contact: contact.id, deal: deal.id } });

        const body = await (await contactOverview(req(`/api/contacts/${contact.id}/overview`), ctx(contact.id))).json();
        expect(body.summary).toHaveLength(1);
        expect(body.summary[0]).toMatchObject({ currency: "EUR", invoiced: 200, paid: 40, outstanding: 160, expenses: 30, margin: 10 });
        expect(body.invoices.map((i: any) => i.number).sort()).toEqual(["A", "B"]); // черновик не считается
        expect(body.invoices.find((i: any) => i.number === "B").overdue).toBe(true);
        expect(body.tasks).toHaveLength(1);
        expect(body.payments[0]).toMatchObject({ amount: 40, number: "A" });

        const d = await (await dealOverview(req(`/api/deals/${deal.id}/overview`), ctx(deal.id))).json();
        expect(d.summary[0].margin).toBe(10);
        expect(d.deals).toEqual([]);

        const docs = await (await companyDocs(req(`/api/companies/${company.id}/documents`), ctx(company.id))).json();
        expect(docs.map((x: any) => x.number).sort()).toEqual(["A", "B"]);
    });

    it("чужой клиент не открывается", async () => {
        const mine = await makeOrg();
        const other = await makeOrg();
        const contact = await prisma.contact.create({ data: { owner: other.org, name: "Чужой" } });
        const res = await contactOverview(asUser(mine.userId)(`/api/contacts/${contact.id}/overview`), ctx(contact.id));
        expect(res.status).toBe(404);
    });

    it("ревизия данных фирмы меняется, когда данные изменились", async () => {
        const { org, userId } = await makeOrg();
        const req = asUser(userId);
        const rev = async () => (await (await notifications(req("/api/notifications"))).json()).rev as string;
        const before = await rev();
        await prisma.contact.create({ data: { owner: org, name: "Новый" } });
        const after = await rev();
        expect(after).not.toBe(before);
        expect(await rev()).toBe(after);
    });
});
