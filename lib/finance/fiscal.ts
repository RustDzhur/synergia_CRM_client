import { ProviderError } from "@/lib/http";
import { packSecrets, secretsOf } from "@/lib/integrations";
import { randomToken } from "@/lib/crypto";
import Integration from "@/models/Integration";
import { prisma } from "@/lib/prisma";
import { closeShift, currentShift, listShifts, openShift, receiptById, returnReceipt, sellReceipt, signIn, taxes, type CbGood, type CbPayType } from "@/lib/checkbox";

// Фискализация счетов через ПРРО Checkbox: когда счёт оплачен, чек пробивается сам, а клиент
// получает его от Checkbox (по почте или в SMS). Это требование украинского закона, но подключение —
// добровольное: если ПРРО не подключён, оплата просто фиксируется без чека.

type Doc = any;

export const findFiscal = (org: string) => prisma.integration.findFirst({ where: { owner: org, type: "checkbox", status: "connected" } });

interface FiscalCredentials { licenseKey: string; login: string; password: string; cashierName: string; department: string; auto: boolean }

export function fiscalConfig(doc: any): FiscalCredentials {
    const s = secretsOf<{ licenseKey?: string; login?: string; password?: string }>(doc);
    return {
        licenseKey: String(s.licenseKey ?? ""),
        login: String(s.login ?? ""),
        password: String(s.password ?? ""),
        cashierName: String(doc.config?.cashierName ?? ""),
        department: String(doc.config?.department ?? ""),
        auto: doc.config?.autoFiscal === "1",
    };
}

// Токен кассира живёт коротко и не нужен между запросами: входим каждый раз — так не бывает
// «повисшего» токена после смены пароля
async function withToken<T>(cfg: FiscalCredentials, fn: (token: string) => Promise<T>): Promise<T> {
    const token = await signIn(cfg.licenseKey, cfg.login, cfg.password);
    return fn(token);
}

export interface FiscalResult { fiscalCode: string; url: string; receiptId: string }

/**
 * Дотянуть ссылку на чек, если она не сохранилась (старые чеки, ответ без tax_url): Checkbox отдаёт
 * её при повторном чтении чека по id. Обновляет счёт и возвращает ссылку — по ней чек открывают,
 * скачивают и печатают.
 */
export async function syncReceiptUrls(org: string, inv: {
    fiscalId?: string; fiscalUrl?: string;
    fiscalReturnId?: string; fiscalReturnUrl?: string;
    save: () => Promise<unknown>;
}): Promise<{ url: string; returnUrl: string }> {
    const doc = await findFiscal(org);
    if (!doc) throw new ProviderError("ПРРО Checkbox не підключено до цієї фірми");
    const cfg = fiscalConfig(doc);
    if (!cfg.licenseKey || !cfg.login || !cfg.password) throw new ProviderError("У налаштуваннях Checkbox не заповнені ключ каси, логін або пароль касира");
    let url = String(inv.fiscalUrl ?? "");
    let returnUrl = String(inv.fiscalReturnUrl ?? "");
    await withToken(cfg, async (token) => {
        if (!url && inv.fiscalId) {
            const receipt = await receiptById(cfg.licenseKey, token, inv.fiscalId);
            url = receipt.url;
            if (url) inv.fiscalUrl = url;
        }
        if (!returnUrl && inv.fiscalReturnId) {
            const receipt = await receiptById(cfg.licenseKey, token, inv.fiscalReturnId);
            returnUrl = receipt.url;
            if (returnUrl) inv.fiscalReturnUrl = returnUrl;
        }
    });
    if (url || returnUrl) await inv.save();
    return { url, returnUrl };
}

// ── Когда чек нужен ─────────────────────────────────────────────────────────────────────────────────

/** Оплата пришла через эквайринг (monobank/LiqPay/WayForPay/крипта) — для покупателя это карта */
export const paidByCard = (inv: { paidVia?: string }) => ["monobank", "liqpay", "wayforpay", "cryptopay"].includes(String(inv.paidVia ?? ""));

export interface FiscalAdvice {
    needed: boolean;
    payType: CbPayType;
    reason: string;
}

/** Нужен ли чек по этому счёту и каким способом он, скорее всего, был оплачен. */
export function fiscalAdvice(inv: { paidVia?: string; paidAmount?: number; totalGross?: number }): FiscalAdvice {
    if (paidByCard(inv)) return { needed: true, payType: "CARD", reason: "Оплата пройшла через еквайринг (картка) — чек ПРРО обов'язковий" };
    return { needed: false, payType: "CASH", reason: "Безготівкова оплата за рахунком: зазвичай достатньо рахунку й акта; чек можна пробити в один клік" };
}

/**
 * Пробить чек по счёту. Сумма — фактически оплаченная (или вся), позиции — из строк счёта.
 * Копия чека уходит клиенту от самого Checkbox: почта и телефон берутся из связанного контакта
 * или фирмы, иначе чек просто остаётся в кассе.
 */
export async function fiscalizeInvoice(org: string, invoice: any, amount?: number, payType?: CbPayType): Promise<FiscalResult> {
    const doc = await findFiscal(org);
    if (!doc) throw new ProviderError("ПРРО Checkbox не підключено до цієї фірми");
    const cfg = fiscalConfig(doc);
    if (!cfg.licenseKey || !cfg.login || !cfg.password) throw new ProviderError("У налаштуваннях Checkbox не заповнені ключ каси, логін або пароль касира");

    // Кому отправить копию чека: сначала контакт, потом фирма
    const [contact, company] = await Promise.all([
        invoice.contact ? prisma.contact.findFirst({ where: { id: String(invoice.contact), owner: org }, select: { email: true, phone: true } }) : null,
        invoice.company ? prisma.company.findFirst({ where: { id: String(invoice.company), owner: org }, select: { email: true } }) : null,
    ]);
    const email = String(contact?.email || company?.email || "");
    const phone = String(contact?.phone || "");

    const items = (invoice.items ?? []) as { description?: string; qty?: number; unitPrice?: number }[];
    if (!items.length) throw new ProviderError("У счёте немає позицій — чек нема з чого скласти");

    return withToken(cfg, async (token) => {
        const shift = await currentShift(cfg.licenseKey, token);
        if (!shift) {
            const opened = await openShift(cfg.licenseKey, token);
            await ensureShift(org, opened.id);
        }
        const taxesList = await taxes(cfg.licenseKey, token);
        const taxForRate = (rate: number): string | undefined => {
            if (!rate) return undefined;
            const byRate = taxesList.find((t) => t.label.includes(`${rate}%`) || t.label.includes(`${rate} %`) || t.code === (rate === 20 ? "А" : rate === 7 ? "Б" : ""));
            if (byRate) return byRate.id;
            return taxesList.find((t) => /пдв|vat/i.test(t.label))?.id;
        };

        const goods: CbGood[] = items.map((it) => {
            const rate = Number((it as { taxRate?: number }).taxRate) || 0;
            const taxId = taxForRate(rate);
            return {
                name: String(it.description ?? "Послуга"),
                price: Number(it.unitPrice) || 0,
                qty: Number(it.qty) || 1,
                ...(taxId ? { taxId } : {}),
            };
        });
        const total = Number(amount) || goods.reduce((sum, g) => sum + g.price * g.qty, 0);
        const receipt = await sellReceipt(cfg.licenseKey, token, {
            goods,
            amount: total,
            cashierName: cfg.cashierName,
            payType: payType ?? fiscalAdvice(invoice).payType,
            delivery: { ...(email ? { emails: [email] } : {}), ...(phone ? { phone } : {}) },
        });
        return { fiscalCode: receipt.fiscalCode, url: receipt.url, receiptId: receipt.id };
    });
}

/**
 * Чек возврата по счёту: ссылается на исходный чек кассы (previous_receipt_id). Делается, когда
 * по счёту выпустили кредит-ноту — деньги вернулись клиенту, и касса должна это видеть.
 */
export async function fiscalizeReturn(org: string, invoice: any, amount?: number, payType?: CbPayType): Promise<FiscalResult> {
    const doc = await findFiscal(org);
    if (!doc) throw new ProviderError("ПРРО Checkbox не підключено до цієї фірми");
    const cfg = fiscalConfig(doc);
    const previousReceiptId = String(invoice.fiscalId ?? "");
    if (!previousReceiptId) throw new ProviderError("За цим рахунком не пробито чек продажу — повертати нічого");

    const items = (invoice.items ?? []) as { description?: string; qty?: number; unitPrice?: number }[];
    if (!items.length) throw new ProviderError("У рахунку немає позицій — чек повернення нема з чого скласти");
    const [contact, company] = await Promise.all([
        invoice.contact ? prisma.contact.findFirst({ where: { id: String(invoice.contact), owner: org }, select: { email: true, phone: true } }) : null,
        invoice.company ? prisma.company.findFirst({ where: { id: String(invoice.company), owner: org }, select: { email: true } }) : null,
    ]);

    return withToken(cfg, async (token) => {
        if (!(await currentShift(cfg.licenseKey, token))) {
            const opened = await openShift(cfg.licenseKey, token);
            await ensureShift(org, opened.id);
        }
        const taxesList = await taxes(cfg.licenseKey, token);
        const vat = taxesList.find((t) => /пдв|vat/i.test(t.label) || /^А$/i.test(t.code));
        const goods: CbGood[] = items.map((it) => ({
            name: String(it.description ?? "Послуга"),
            price: Number(it.unitPrice) || 0,
            qty: Number(it.qty) || 1,
            ...(vat ? { taxId: vat.id } : {}),
        }));
        const total = Number(amount) || goods.reduce((sum, g) => sum + g.price * g.qty, 0);
        const receipt = await returnReceipt(cfg.licenseKey, token, {
            goods,
            amount: total,
            previousReceiptId,
            cashierName: cfg.cashierName,
            payType: payType ?? "CARD",
            delivery: {
                ...(String(contact?.email || company?.email || "") ? { emails: [String(contact?.email || company?.email)] } : {}),
                ...(String(contact?.phone || "") ? { phone: String(contact?.phone) } : {}),
            },
        });
        return { fiscalCode: receipt.fiscalCode, url: receipt.url, receiptId: receipt.id };
    });
}

// ── Смена кассы ─────────────────────────────────────────────────────────────────────────────────────

export interface ShiftState {
    open: { id: string; openedAt?: string } | null;
    recent: Array<{ id: string; openedAt: string | null; closedAt: string | null; receipts: number; turnover: number }>;
}

/** Состояние смены: открыта ли, и что показывали последние Z-отчёты. */
export async function shiftState(org: string): Promise<ShiftState> {
    const doc = await findFiscal(org);
    const shifts = await prisma.fiscalShift.findMany({ where: { org }, orderBy: { openedAt: "desc" }, take: 10 });
    const recent = shifts.filter((s) => s.closedAt).map((s) => ({
        id: String(s.shiftId),
        openedAt: s.openedAt ? new Date(s.openedAt).toISOString() : null,
        closedAt: s.closedAt ? new Date(s.closedAt).toISOString() : null,
        receipts: Number(s.receipts) || 0,
        turnover: Number(s.turnover) || 0,
    }));
    if (!doc) return { open: null, recent };
    const cfg = fiscalConfig(doc);
    try {
        const shift = await withToken(cfg, (token) => currentShift(cfg.licenseKey, token));
        return { open: shift ? { id: shift.id } : null, recent };
    } catch {
        return { open: null, recent };
    }
}

/** Закрыть смену и сохранить Z-отчёт в журнал. */
export async function closeFiscalShift(org: string): Promise<{ id: string; receipts: number; turnover: number }> {
    const doc = await findFiscal(org);
    if (!doc) throw new ProviderError("ПРРО Checkbox не підключено до цієї фірми");
    const cfg = fiscalConfig(doc);
    return withToken(cfg, async (token) => {
        const shift = await currentShift(cfg.licenseKey, token);
        if (!shift) throw new ProviderError("Відкритої зміни немає — закривати нічого");
        const report = await closeShift(cfg.licenseKey, token, shift.id);
        const data = { closedAt: new Date(), receipts: report.receipts, turnover: report.turnover, zReport: report.raw as any };
        const existing = await prisma.fiscalShift.findFirst({ where: { org, shiftId: shift.id } });
        if (existing) await prisma.fiscalShift.update({ where: { id: existing.id }, data });
        else await prisma.fiscalShift.create({ data: { org, provider: "checkbox", shiftId: shift.id, openedAt: new Date(), ...data } });
        return { id: shift.id, receipts: report.receipts, turnover: report.turnover };
    });
}

/** Открыть смену вручную (обычно её открывает первый чек). */
export async function openFiscalShift(org: string): Promise<{ id: string }> {
    const doc = await findFiscal(org);
    if (!doc) throw new ProviderError("ПРРО Checkbox не підключено до цієї фірми");
    const cfg = fiscalConfig(doc);
    return withToken(cfg, async (token) => {
        const existing = await currentShift(cfg.licenseKey, token);
        if (existing) return { id: existing.id };
        const opened = await openShift(cfg.licenseKey, token);
        await ensureShift(org, opened.id);
        return { id: opened.id };
    });
}

/** История смен из кассы (для сверки с журналом CRM). */
export async function remoteShifts(org: string) {
    const doc = await findFiscal(org);
    if (!doc) throw new ProviderError("ПРРО Checkbox не підключено до цієї фірми");
    const cfg = fiscalConfig(doc);
    return withToken(cfg, (token) => listShifts(cfg.licenseKey, token));
}

/** Сохранение подключения: ключ и пароль проверяются входом кассира до записи (как у ботов и почты) */
export async function saveFiscal(
    org: string,
    input: { licenseKey: string; login: string; password: string; cashierName: string; department: string; autoFiscal: boolean }
): Promise<Doc> {
    const doc = (await Integration.findOne({ owner: org, type: "checkbox" })) ?? new Integration({ owner: org, type: "checkbox", token: randomToken() });
    const previous = (() => {
        try { return secretsOf<{ licenseKey?: string; login?: string; password?: string }>(doc); } catch { return {}; }
    })();
    const licenseKey = input.licenseKey.trim() || String(previous.licenseKey ?? "");
    const login = input.login.trim() || String(previous.login ?? "");
    const password = input.password.trim() || String(previous.password ?? "");
    if (!licenseKey || !login || !password) throw new ProviderError("Заповніть ключ каси, логін і пароль касира");
    await signIn(licenseKey, login, password);
    doc.set({
        name: input.cashierName.trim() || "Checkbox",
        config: { cashierName: input.cashierName.trim(), department: input.department.trim(), autoFiscal: input.autoFiscal ? "1" : "0" },
        secrets: packSecrets({ licenseKey, login, password }),
        status: "connected",
        error: "",
    });
    doc.markModified("config");
    await doc.save();
    return doc;
}

// Открыть смену в журнале (upsert по org+shiftId)
async function ensureShift(org: string, shiftId: string) {
    const existing = await prisma.fiscalShift.findFirst({ where: { org, shiftId } });
    if (!existing) await prisma.fiscalShift.create({ data: { org, provider: "checkbox", shiftId, openedAt: new Date() } });
}
