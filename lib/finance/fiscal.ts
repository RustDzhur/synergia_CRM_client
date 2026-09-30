import { ProviderError } from "@/lib/http";
import { packSecrets, secretsOf } from "@/lib/integrations";
import { randomToken } from "@/lib/crypto";
import Integration from "@/models/Integration";
import Contact from "@/models/Contact";
import Company from "@/models/Company";
import type { HydratedDocument } from "mongoose";
import { currentShift, openShift, sellReceipt, signIn, taxes, type CbGood } from "@/lib/checkbox";

// Фискализация счетов через ПРРО Checkbox: когда счёт оплачен, чек пробивается сам, а клиент
// получает его от Checkbox (по почте или в SMS). Это требование украинского закона, но подключение —
// добровольное: если ПРРО не подключён, оплата просто фиксируется без чека.

type Doc = HydratedDocument<any>;

export const findFiscal = (org: string) => Integration.findOne({ owner: org, type: "checkbox", status: "connected" });

interface FiscalCredentials { licenseKey: string; login: string; password: string; cashierName: string; department: string; auto: boolean }

export function fiscalConfig(doc: Doc): FiscalCredentials {
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
 * Пробить чек по счёту. Сумма — фактически оплаченная (или вся), позиции — из строк счёта.
 * Копия чека уходит клиенту от самого Checkbox: почта и телефон берутся из связанного контакта
 * или фирмы, иначе чек просто остаётся в кассе.
 */
export async function fiscalizeInvoice(org: string, invoice: Doc, amount?: number): Promise<FiscalResult> {
    const doc = await findFiscal(org);
    if (!doc) throw new ProviderError("ПРРО Checkbox не підключено до цієї фірми");
    const cfg = fiscalConfig(doc);
    if (!cfg.licenseKey || !cfg.login || !cfg.password) throw new ProviderError("У налаштуваннях Checkbox не заповнені ключ каси, логін або пароль касира");

    // Кому отправить копию чека: сначала контакт, потом фирма
    const [contact, company] = await Promise.all([
        invoice.contact ? Contact.findOne({ _id: invoice.contact, owner: org }).select("email phone") : null,
        invoice.company ? Company.findOne({ _id: invoice.company, owner: org }).select("email phone") : null,
    ]);
    const email = String(contact?.email || company?.email || "");
    const phone = String(contact?.phone || company?.phone || "");

    const items = (invoice.items ?? []) as { description?: string; qty?: number; unitPrice?: number }[];
    if (!items.length) throw new ProviderError("У счёте немає позицій — чек нема з чого скласти");

    return withToken(cfg, async (token) => {
        // Смена: без открытой смены Checkbox чек не принимает. Открываем сами, если её нет.
        if (!(await currentShift(cfg.licenseKey, token))) await openShift(cfg.licenseKey, token);
        // Коды налогов нужны только плательщику ПДВ; у неплательщика касса их не примет, поэтому
        // ставку подставляем лишь когда Checkbox её отдал
        const taxesList = await taxes(cfg.licenseKey, token);
        const vat = taxesList.find((t) => /пдв|vat/i.test(t.label) || /^А$/i.test(t.code));

        const goods: CbGood[] = items.map((it) => ({
            name: String(it.description ?? "Послуга"),
            price: Number(it.unitPrice) || 0,
            qty: Number(it.qty) || 1,
            ...(vat ? { taxId: vat.id } : {}),
        }));
        const total = Number(amount) || goods.reduce((sum, g) => sum + g.price * g.qty, 0);
        const receipt = await sellReceipt(cfg.licenseKey, token, {
            goods,
            amount: total,
            cashierName: cfg.cashierName,
            delivery: { ...(email ? { emails: [email] } : {}), ...(phone ? { phone } : {}) },
        });
        return { fiscalCode: receipt.fiscalCode, url: receipt.url, receiptId: receipt.id };
    });
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
    // Проверяем входом: неверный пароль не должен тихо лечь в базу
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
