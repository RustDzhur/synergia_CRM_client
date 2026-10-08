import { describe, expect, it } from "vitest";
import { hasDb, makeOrg, prisma } from "./helpers/db";
import { packSecrets } from "@/lib/integrations";
import { handlePayme, paymeCheckoutUrl } from "@/lib/uzpay/payme";
import { clickPayUrl, clickSign, handleClick } from "@/lib/uzpay/click";
import { createPayLink } from "@/lib/payments";

const items = [{ description: "Работа", qty: 1, unitPrice: 100000, taxRate: 0 }];
const RUN = Math.random().toString(36).slice(2, 8);
const pid = (c: string) => (RUN + c.repeat(24)).slice(0, 24);
const RUNN = Date.now() % 1000000;
const cid = (n: number) => `${RUNN}${n}`;
const basic = (pass: string, login = "Paycom") => `Basic ${Buffer.from(`${login}:${pass}`).toString("base64")}`;

async function scene(currency = "UZS") {
    const { org } = await makeOrg();
    const number = `HF-${Math.random().toString(36).slice(2, 8)}`;
    const invoice = await prisma.invoice.create({ data: { org, number, customerName: "Клиент", issueDate: "2026-01-01", status: "sent", currency, items: items as never } });
    return { org, number, invoice };
}
const rpc = (method: string, params: object, id = 1) => JSON.stringify({ method, params, id });
const reload = (id: string) => prisma.invoice.findUniqueOrThrow({ where: { id } });

describe.skipIf(!hasDb)("Payme Merchant API", () => {
    const doc = (org: string) => ({ owner: org, secrets: packSecrets({ key: "PROD_KEY", testKey: "TEST_KEY" }), config: { merchantId: "m1", mode: "test" } });
    const call = async (org: string, method: string, params: object, auth = basic("PROD_KEY")) => handlePayme(doc(org), auth, rpc(method, params)) as Promise<any>;

    it("авторизация: нет заголовка, чужой ключ и чужой логин — -32504; тестовый ключ принимается", async () => {
        const s = await scene();
        const p = { amount: 10000000, account: { order_id: s.number } };
        expect((await call(s.org, "CheckPerformTransaction", p, "")).error.code).toBe(-32504);
        expect((await call(s.org, "CheckPerformTransaction", p, basic("WRONG"))).error.code).toBe(-32504);
        expect((await call(s.org, "CheckPerformTransaction", p, basic("PROD_KEY", "Other"))).error.code).toBe(-32504);
        expect((await call(s.org, "CheckPerformTransaction", p, basic("TEST_KEY"))).result.allow).toBe(true);
    });

    it("проверка суммы и счёта: неверная сумма -31001, нет счёта -31050 с полем data", async () => {
        const s = await scene();
        expect((await call(s.org, "CheckPerformTransaction", { amount: 5, account: { order_id: s.number } })).error.code).toBe(-31001);
        const miss = await call(s.org, "CheckPerformTransaction", { amount: 10000000, account: { order_id: "нет" } });
        expect(miss.error.code).toBe(-31050);
        expect(miss.error.data).toBe("order_id");
        expect(miss.error.message.uz).toBeTruthy();
        const usd = await scene("USD");
        expect((await call(usd.org, "CheckPerformTransaction", { amount: 10000000, account: { order_id: usd.number } })).error.code).toBe(-31050);
    });

    it("чужая фирма: номер счёта другой фирмы не находится", async () => {
        const a = await scene(), b = await scene();
        expect((await call(b.org, "CheckPerformTransaction", { amount: 10000000, account: { order_id: a.number } })).error.code).toBe(-31050);
    });

    it("полный цикл: создать → повтор → вторая транзакция -31008 → выполнить (счёт оплачен) → повтор → проверить → GetStatement", async () => {
        const s = await scene();
        const acc = { order_id: s.number };
        const t0 = Date.now();
        const c1 = await call(s.org, "CreateTransaction", { id: pid("a"), time: t0, amount: 10000000, account: acc });
        expect(c1.result.state).toBe(1);
        const c2 = await call(s.org, "CreateTransaction", { id: pid("a"), time: t0, amount: 10000000, account: acc });
        expect(c2.result).toEqual(c1.result);
        expect((await call(s.org, "CreateTransaction", { id: pid("b"), time: t0, amount: 10000000, account: acc })).error.code).toBe(-31008);
        const p1 = await call(s.org, "PerformTransaction", { id: pid("a") });
        expect(p1.result.state).toBe(2);
        expect((await call(s.org, "PerformTransaction", { id: pid("a") })).result.perform_time).toBe(p1.result.perform_time);
        const inv = await reload(s.invoice.id);
        expect(inv.status).toBe("paid");
        expect(inv.paidAmount).toBe(100000);
        expect(await prisma.paymentEvent.count({ where: { invoice: s.invoice.id } })).toBe(1);
        const chk = await call(s.org, "CheckTransaction", { id: pid("a") });
        expect(chk.result.state).toBe(2);
        expect(chk.result.transaction).toBe(c1.result.transaction);
        const st = await call(s.org, "GetStatement", { from: t0 - 1000, to: t0 + 1000 });
        expect(st.result.transactions).toHaveLength(1);
        expect(st.result.transactions[0]).toMatchObject({ id: pid("a"), amount: 10000000, account: { order_id: s.number }, state: 2 });
    });

    it("возврат после выполнения: -2, счёт снова не оплачен; повтор отмены даёт тот же ответ", async () => {
        const s = await scene();
        const id = pid("c");
        await call(s.org, "CreateTransaction", { id, time: Date.now(), amount: 10000000, account: { order_id: s.number } });
        await call(s.org, "PerformTransaction", { id });
        const cx = await call(s.org, "CancelTransaction", { id, reason: 5 });
        expect(cx.result.state).toBe(-2);
        expect((await call(s.org, "CancelTransaction", { id, reason: 5 })).result).toEqual(cx.result);
        const inv = await reload(s.invoice.id);
        expect(inv.paidAmount).toBe(0);
        expect(inv.status).toBe("sent");
        expect((await call(s.org, "PerformTransaction", { id })).error.code).toBe(-31008);
    });

    it("отмена до выполнения: -1, счёт свободен для новой транзакции; несуществующая транзакция -31003", async () => {
        const s = await scene();
        const id = pid("d");
        await call(s.org, "CreateTransaction", { id, time: Date.now(), amount: 10000000, account: { order_id: s.number } });
        expect((await call(s.org, "CancelTransaction", { id, reason: 3 })).result.state).toBe(-1);
        expect((await call(s.org, "CreateTransaction", { id: pid("e"), time: Date.now(), amount: 10000000, account: { order_id: s.number } })).result.state).toBe(1);
        expect((await call(s.org, "CheckTransaction", { id: pid("z") })).error.code).toBe(-31003);
    });

    it("просроченная (12 ч) транзакция при выполнении отменяется с причиной 4", async () => {
        const s = await scene();
        const id = pid("f");
        await call(s.org, "CreateTransaction", { id, time: Date.now(), amount: 10000000, account: { order_id: s.number } });
        await prisma.uzPayTx.updateMany({ where: { externalId: id }, data: { createdAt: new Date(Date.now() - 13 * 3600_000) } });
        expect((await call(s.org, "PerformTransaction", { id })).error.code).toBe(-31008);
        const chk = await call(s.org, "CheckTransaction", { id });
        expect(chk.result).toMatchObject({ state: -1, reason: 4 });
        expect((await reload(s.invoice.id)).status).toBe("sent");
    });

    it("транзакцию другой фирмы не видно; мусор и неизвестный метод — ошибки протокола", async () => {
        const a = await scene(), b = await scene();
        const id = pid("g");
        await call(a.org, "CreateTransaction", { id, time: Date.now(), amount: 10000000, account: { order_id: a.number } });
        expect((await call(b.org, "CheckTransaction", { id })).error.code).toBe(-31003);
        expect(((await handlePayme(doc(a.org), basic("PROD_KEY"), "{not json")) as any).error.code).toBe(-32700);
        expect((await call(a.org, "Nope", {})).error.code).toBe(-32601);
    });

    it("ссылка на кассу: base64 с m, ac.order_id, a в тийинах, языком и валютой", () => {
        const url = paymeCheckoutUrl({ merchantId: "m1", test: false, reference: "HF-1", amountSom: 1500.5, locale: "uz", returnUrl: "https://x.uz/done" });
        expect(url.startsWith("https://checkout.paycom.uz/")).toBe(true);
        expect(Buffer.from(url.split("/").pop()!, "base64").toString()).toBe("m=m1;ac.order_id=HF-1;a=150050;l=uz;c=https://x.uz/done;cr=860");
        expect(paymeCheckoutUrl({ merchantId: "m1", test: true, reference: "HF-1", amountSom: 1, locale: "ua", returnUrl: "u" }).startsWith("https://test.paycom.uz/")).toBe(true);
    });
});

describe.skipIf(!hasDb)("Click SHOP API", () => {
    const SECRET = "click-secret";
    const doc = (org: string) => ({ owner: org, secrets: packSecrets({ secretKey: SECRET }), config: { merchantId: "7", serviceId: "31" } });
    const form = (p: Record<string, string>) => new URLSearchParams(p).toString();
    function req(p: Record<string, string>, complete = false, secret = SECRET) {
        const base = { service_id: "31", click_paydoc_id: "555", sign_time: "2026-10-08 12:00:00", error: "0", error_note: "Success", ...p };
        return { ...base, sign_string: clickSign(secret, base as Record<string, string>, complete) };
    }
    const run = (org: string, p: Record<string, string>) => handleClick(doc(org), form(p)) as Promise<any>;

    it("подпись и сервис проверяются: чужая подпись -1, чужой service_id -8, неизвестное действие -3", async () => {
        const s = await scene();
        const p = { click_trans_id: cid(1001), merchant_trans_id: s.number, amount: "100000", action: "0" };
        expect((await run(s.org, req(p, false, "bad"))).error).toBe(-1);
        expect((await run(s.org, { ...req(p), service_id: "99" })).error).toBe(-1);
        expect((await run(s.org, req({ ...p, action: "7" }))).error).toBe(-3);
    });

    it("Prepare: нет счёта -5, неверная сумма -2, успешный возвращает merchant_prepare_id; повтор — тот же", async () => {
        const s = await scene();
        expect((await run(s.org, req({ click_trans_id: cid(1), merchant_trans_id: "нет", amount: "100000", action: "0" }))).error).toBe(-5);
        expect((await run(s.org, req({ click_trans_id: cid(2), merchant_trans_id: s.number, amount: "5", action: "0" }))).error).toBe(-2);
        const a = await run(s.org, req({ click_trans_id: cid(3), merchant_trans_id: s.number, amount: "100000.00", action: "0" }));
        expect(a.error).toBe(0);
        expect(a.merchant_prepare_id).toBeGreaterThan(0);
        const b = await run(s.org, req({ click_trans_id: cid(3), merchant_trans_id: s.number, amount: "100000.00", action: "0" }));
        expect(b.merchant_prepare_id).toBe(a.merchant_prepare_id);
    });

    it("Complete: списание → счёт оплачен; повтор → -4; подпись Complete включает merchant_prepare_id", async () => {
        const s = await scene();
        const prep = await run(s.org, req({ click_trans_id: cid(10), merchant_trans_id: s.number, amount: "100000", action: "0" }));
        const c = { click_trans_id: cid(10), merchant_trans_id: s.number, merchant_prepare_id: String(prep.merchant_prepare_id), amount: "100000", action: "1" };
        // подпись без merchant_prepare_id (как у Prepare) не проходит
        expect((await run(s.org, { ...req(c, false) })).error).toBe(-1);
        const done = await run(s.org, req(c, true));
        expect(done).toMatchObject({ error: 0, merchant_confirm_id: prep.merchant_prepare_id });
        const inv = await reload(s.invoice.id);
        expect(inv.status).toBe("paid");
        expect(inv.paidAmount).toBe(100000);
        expect((await run(s.org, req(c, true))).error).toBe(-4);
        expect((await reload(s.invoice.id)).paidAmount).toBe(100000);
        // Prepare оплаченного счёта
        expect((await run(s.org, req({ click_trans_id: cid(11), merchant_trans_id: s.number, amount: "100000", action: "0" }))).error).toBe(-4);
    });

    it("Complete с ошибкой Click (error<0) снимает резерв и отвечает -9; счёт остаётся неоплаченным", async () => {
        const s = await scene();
        const prep = await run(s.org, req({ click_trans_id: cid(20), merchant_trans_id: s.number, amount: "100000", action: "0" }));
        const c = { click_trans_id: cid(20), merchant_trans_id: s.number, merchant_prepare_id: String(prep.merchant_prepare_id), amount: "100000", action: "1", error: "-5017" };
        expect((await run(s.org, req(c, true))).error).toBe(-9);
        expect((await reload(s.invoice.id)).status).toBe("sent");
        expect((await run(s.org, req({ click_trans_id: cid(20), merchant_trans_id: s.number, amount: "100000", action: "0" }))).error).toBe(-9);
    });

    it("чужая фирма не находит счёт; номер подготовки другой фирмы не подходит", async () => {
        const a = await scene(), b = await scene();
        expect((await run(b.org, req({ click_trans_id: cid(30), merchant_trans_id: a.number, amount: "100000", action: "0" }))).error).toBe(-5);
        const prep = await run(a.org, req({ click_trans_id: cid(31), merchant_trans_id: a.number, amount: "100000", action: "0" }));
        const c = { click_trans_id: cid(31), merchant_trans_id: a.number, merchant_prepare_id: String(prep.merchant_prepare_id), amount: "100000", action: "1" };
        expect((await run(b.org, req(c, true))).error).toBe(-6);
    });

    it("ссылка на оплату Click: сумма N.NN, номер счёта в transaction_param", () => {
        const u = new URL(clickPayUrl({ merchantId: "7", serviceId: "31", merchantUserId: "4", reference: "HF-1", amountSom: 1000, returnUrl: "https://x.uz/done" }));
        expect(u.origin + u.pathname).toBe("https://my.click.uz/services/pay");
        expect(Object.fromEntries(u.searchParams)).toEqual({ service_id: "31", merchant_id: "7", amount: "1000.00", transaction_param: "HF-1", return_url: "https://x.uz/done", merchant_user_id: "4" });
    });
});

describe("ссылки на оплату через общий вызов", () => {
    it("только в сумах", async () => {
        const doc = { config: { merchantId: "m1", serviceId: "31", mode: "live" } };
        const base = { amount: 100, reference: "HF-1", description: "x", webhookUrl: "", returnUrl: "https://x.uz", locale: "uz" };
        await expect(createPayLink("payme", doc, { ...base, currency: "USD" })).rejects.toThrow(/UZS/);
        expect((await createPayLink("click", doc, { ...base, currency: "UZS" })).url).toContain("my.click.uz");
        expect((await createPayLink("payme", doc, { ...base, currency: "UZS" })).url).toContain("checkout.paycom.uz");
    });
});
