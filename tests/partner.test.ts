import { describe, expect, it } from "vitest";
import { hasDb, makeOrg, prisma } from "./helpers/db";
import { asUser, ctx } from "./helpers/http";
import { createPartner } from "@/lib/partner/service";
import { GET as landing, POST as visit } from "@/app/api/partner/[code]/route";
import { POST as attach } from "@/app/api/partner/attach/route";
import { PATCH as patchMine, GET as mine } from "@/app/api/partner/mine/route";
import { GET as offers, POST as createOffer } from "@/app/api/bank-offers/route";
import { DELETE as revokeOffer } from "@/app/api/bank-offers/[id]/route";
import { GET as stats } from "@/app/api/bank-partner/stats/route";
import { GET as leads } from "@/app/api/bank-partner/leads/route";
import { POST as newCode } from "@/app/api/bank-partner/codes/route";
import { PATCH as toggleCode } from "@/app/api/bank-partner/codes/[id]/route";
import { GET as sandbox } from "@/app/api/bank-partner/sandbox/route";
import { POST as adminCreate } from "@/app/api/admin/bank-partners/route";
import { linkBankAccount, unlinkBankAccount } from "@/lib/banks/link";

async function bankScene() {
    const bankUser = await makeOrg();
    await prisma.user.update({ where: { id: bankUser.userId }, data: { email: `bank${bankUser.userId}@t.local` } });
    const partner = await createPartner({ name: "Test Bank", bankProvider: "monobank", memberEmail: `bank${bankUser.userId}@t.local` });
    const code = (await prisma.bankPartnerCode.findFirst({ where: { partner: partner.id } }))!.code;
    return { bankUser, partner, code, bank: asUser(bankUser.userId) };
}

describe.skipIf(!hasDb)("банк-партнёр", () => {
    it("страница по коду, визиты, атрибуция без дублей; чужой/выключенный код не работает", async () => {
        const s = await bankScene();
        const l = await landing(new Request("http://x"), { params: { code: s.code } });
        expect(l.status).toBe(200);
        expect((await l.json()).name).toBe("Test Bank");
        expect((await visit(new Request("http://x", { method: "POST" }), { params: { code: s.code } })).status).toBe(200);
        expect((await landing(new Request("http://x"), { params: { code: "NOPE" } })).status).toBe(404);
        const firm = await makeOrg();
        const req = asUser(firm.userId);
        expect((await attach(req("/api/partner/attach", "POST", { code: s.code }))).status).toBe(201);
        expect((await attach(req("/api/partner/attach", "POST", { code: s.code }))).status).toBe(201);
        expect(await prisma.partnerReferral.count({ where: { org: firm.org } })).toBe(1);
        expect((await attach(req("/api/partner/attach", "POST", { code: "WRONGCODE" }))).status).toBe(404);
        const st = await (await stats(s.bank("/api/bank-partner/stats"))).json();
        expect(st.funnel).toMatchObject({ visits: 1, registered: 1, activated: 0, connected: 0 });
        // выключенный код
        const id = st.codes[0].id;
        expect((await toggleCode(s.bank(`/api/bank-partner/codes/${id}`, "PATCH", { active: false }), ctx(id) as never)).status).toBe(200);
        expect((await landing(new Request("http://x"), { params: { code: s.code } })).status).toBe(404);
        expect((await (await newCode(s.bank("/api/bank-partner/codes", "POST", { label: "promo" }))).json()).code).toHaveLength(8);
    });

    it("объём платежей скрыт, пока согласившихся фирм меньше порога; считается только по согласившимся", async () => {
        const s = await bankScene();
        const firms = [];
        for (let i = 0; i < 3; i++) {
            const f = await makeOrg();
            firms.push(f);
            await attach(asUser(f.userId)("/api/partner/attach", "POST", { code: s.code, shareVolume: i < 2 }));
            const acc = await prisma.bankAccount.create({ data: { org: f.org, name: "mono", kind: "bank", provider: "monobank", providerAccountId: `a${i}` } });
            await prisma.bankTransaction.create({ data: { org: f.org, account: acc.id, date: new Date().toISOString().slice(0, 10), amount: 1000 } });
            await prisma.invoice.create({ data: { org: f.org, number: "A-1", customerName: "Z", issueDate: "2026-01-01" } });
        }
        let st = await (await stats(s.bank("/api/bank-partner/stats"))).json();
        expect(st.funnel).toMatchObject({ registered: 3, activated: 3, connected: 3 });
        expect(st.volumeLast30d).toBeNull(); // согласились 2 < 3
        // третья фирма даёт согласие
        const ref = (await (await mine(asUser(firms[2].userId)("/api/partner/mine"))).json()).referrals[0];
        await patchMine(asUser(firms[2].userId)("/api/partner/mine", "PATCH", { id: ref.id, shareVolume: true }));
        st = await (await stats(s.bank("/api/bank-partner/stats"))).json();
        expect(st.volumeLast30d).toBe(3000);
        // отзыв — снова скрыто
        await patchMine(asUser(firms[2].userId)("/api/partner/mine", "PATCH", { id: ref.id, shareVolume: false }));
        expect((await (await stats(s.bank("/api/bank-partner/stats"))).json()).volumeLast30d).toBeNull();
        // чужое согласие по id менять нельзя
        expect((await patchMine(asUser(firms[0].userId)("/api/partner/mine", "PATCH", { id: ref.id, shareVolume: true }))).status).toBe(404);
    });

    it("кабинет банка не возвращает данных фирм; посторонний получает 404 на все маршруты", async () => {
        const s = await bankScene();
        const firm = await makeOrg();
        await prisma.organization.update({ where: { id: firm.org }, data: { name: "SecretFirmName" } });
        await prisma.invoice.create({ data: { org: firm.org, number: "S-1", customerName: "SecretCustomer", issueDate: "2026-01-01" } });
        await attach(asUser(firm.userId)("/api/partner/attach", "POST", { code: s.code }));
        for (const [h, url] of [[stats, "/api/bank-partner/stats"], [leads, "/api/bank-partner/leads"], [sandbox, "/api/bank-partner/sandbox"]] as const) {
            const body = JSON.stringify(await (await h(s.bank(url))).json());
            expect(body).not.toContain("SecretFirmName");
            expect(body).not.toContain("SecretCustomer");
            expect(body).not.toContain(firm.org);
            const stranger = await makeOrg();
            expect((await h(asUser(stranger.userId)(url))).status).toBe(404);
        }
        expect((await adminCreate(asUser(firm.userId)("/api/admin/bank-partners", "POST", { name: "X" }))).status).toBe(403);
    });

    it("лид: банк видит только выбранные поля; отзыв и истечение убирают его; согласие записано", async () => {
        const s = await bankScene();
        const firm = await makeOrg();
        await prisma.organization.update({ where: { id: firm.org }, data: { name: "Acme LLC" } });
        const req = asUser(firm.userId);
        expect((await createOffer(req("/api/bank-offers", "POST", { partnerId: s.partner.id, fields: [] }))).status).toBe(400);
        const res = await createOffer(req("/api/bank-offers", "POST", { partnerId: s.partner.id, fields: ["companyName", "password"], days: 10 }));
        expect(res.status).toBe(201);
        const id = (await res.json()).id;
        const got = (await (await leads(s.bank("/api/bank-partner/leads"))).json()).leads;
        expect(got).toHaveLength(1);
        expect(got[0].data).toEqual({ companyName: "Acme LLC" });
        expect(await prisma.consentRecord.count({ where: { org: firm.org, kind: "bank_lead", revokedAt: null } })).toBe(1);
        // чужая фирма отозвать не может
        const other = await makeOrg();
        expect((await revokeOffer(asUser(other.userId)(`/api/bank-offers/${id}`, "DELETE"), ctx(id) as never)).status).toBe(404);
        expect((await revokeOffer(req(`/api/bank-offers/${id}`, "DELETE"), ctx(id) as never)).status).toBe(200);
        expect((await (await leads(s.bank("/api/bank-partner/leads"))).json()).leads).toHaveLength(0);
        expect((await prisma.bankLead.findUnique({ where: { id } }))!.snapshot).toEqual({});
        expect(await prisma.consentRecord.count({ where: { org: firm.org, kind: "bank_lead", revokedAt: null } })).toBe(0);
        // истёкший лид не отдаётся
        const r2 = await (await createOffer(req("/api/bank-offers", "POST", { partnerId: s.partner.id, fields: ["country"] }))).json();
        await prisma.bankLead.update({ where: { id: r2.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
        expect((await (await leads(s.bank("/api/bank-partner/leads"))).json()).leads).toHaveLength(0);
        // клиент видит список банков (без эксклюзивности) и свои заявки
        const mineList = await (await offers(req("/api/bank-offers"))).json();
        expect(mineList.banks.length).toBeGreaterThan(0);
    });

    it("подключение счёта оформляется согласием, отвязка его отзывает и стирает ключи", async () => {
        const f = await makeOrg();
        const acc = await linkBankAccount(f.org, { provider: "monobank", providerAccountId: "x1", name: "A", secret: { token: "t" }, by: f.userId });
        expect(await prisma.consentRecord.count({ where: { org: f.org, kind: "bank_connect", subjectId: acc.id, revokedAt: null } })).toBe(1);
        await linkBankAccount(f.org, { provider: "monobank", providerAccountId: "x1", name: "A", secret: { token: "t2" }, by: f.userId });
        expect(await prisma.consentRecord.count({ where: { org: f.org, kind: "bank_connect", subjectId: acc.id } })).toBe(1);
        await unlinkBankAccount(f.org, acc.id, f.userId);
        const after = await prisma.bankAccount.findUnique({ where: { id: acc.id } });
        expect(after!.providerSecret).toBe("");
        expect(await prisma.consentRecord.count({ where: { org: f.org, kind: "bank_connect", revokedAt: null } })).toBe(0);
    });
});
