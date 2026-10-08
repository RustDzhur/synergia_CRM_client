import { decryptJSON } from "@/lib/crypto";
import { monobankStatement, syncWindow } from "./monobank";
import { privatStatement, privatSyncWindow } from "./privatbank";
import { finishBankSync } from "./link";
import { prisma } from "@/lib/prisma";

// Единый интерфейс банков (docs/TZ_MASTER.md §7.2): маршруты и «обновить всё» работают с банком через него, а не через конкретный
// адаптер. Поведение monobank и ПриватБанка не менялось — адаптеры вызывают прежние функции. Новый банк = один адаптер + паспорт в реестре интеграций.

export type Rows = Array<{ date: string; amount: number; counterparty: string; reference: string; externalId: string }>;
export interface BankAccountRow { id: string; currency?: string; providerAccountId?: string | null; providerSecret?: string | null; providerSyncAt?: Date | null; openingDate?: string | null }

// пустой или повреждённый секрет — то же, что «не сохранён»
const secretOf = <T extends object>(raw?: string | null): T => { try { return (raw ? decryptJSON<T>(raw) : null) ?? ({} as T); } catch { return {} as T; } };

export class BankSyncError extends Error {
    constructor(message: string, public status = 400) { super(message); }
}

export interface BankProvider {
    id: string;
    capabilities: { statement: boolean; balance: boolean; webhook: boolean; initiatePayment: boolean };
    /** Выписка за окно синхронизации; бросает BankSyncError, если секреты не сохранены. */
    statement(account: BankAccountRow): Promise<{ rows: Rows; from: number; to: number }>;
}

const monobank: BankProvider = {
    id: "monobank",
    capabilities: { statement: true, balance: false, webhook: false, initiatePayment: false },
    async statement(a) {
        const { token } = secretOf<{ token?: string }>(a.providerSecret);
        if (!token) throw new BankSyncError("Токен не збережено — прив'яжіть рахунок заново");
        // Окно: с прошлой синхронизации (или за месяц при первой) — выписка за годы не нужна
        const { from, to } = syncWindow(a.providerSyncAt, a.openingDate ?? "");
        const rows = await monobankStatement(token, a.providerAccountId as string, from, to);
        return { rows: rows.map((r) => ({ date: r.date, amount: r.amount, counterparty: r.counterparty, reference: r.reference, externalId: `mono:${r.externalId}` })), from, to };
    },
};

const privatbank: BankProvider = {
    id: "privatbank",
    capabilities: { statement: true, balance: true, webhook: false, initiatePayment: false },
    async statement(a) {
        const { id, token } = secretOf<{ id?: string; token?: string }>(a.providerSecret);
        if (!id || !token) throw new BankSyncError("Ключі не збережено — прив'яжіть рахунок заново");
        const { from, to } = privatSyncWindow(a.providerSyncAt);
        const rows = await privatStatement({ id, token }, a.providerAccountId as string, from, to);
        return { rows: rows.map((r) => ({ date: r.date, amount: r.amount, counterparty: r.counterparty, reference: r.reference, externalId: `privat:${r.externalId}` })), from, to };
    },
};

const REGISTRY = new Map<string, BankProvider>([monobank, privatbank].map((p) => [p.id, p]));
export const bankProvider = (id: string) => REGISTRY.get(id) ?? null;
export const bankProviders = () => Array.from(REGISTRY.values());

const ymd = (sec: number) => new Date(sec * 1000).toISOString().slice(0, 10);

/** Синхронизация одного привязанного счёта через его провайдера. */
export async function syncAccount(org: string, account: BankAccountRow & { provider?: string | null }) {
    const p = bankProvider(account.provider ?? "");
    if (!p) throw new BankSyncError("This account is not linked to a bank");
    const { rows, from, to } = await p.statement(account);
    const result = await finishBankSync(org, account as never, rows, to);
    return { imported: result.created.length, suggestions: result.suggestions, from: ymd(from), to: ymd(to) };
}

/** «Обновить всё»: все привязанные счета фирмы; ошибка одного банка не мешает остальным. */
export async function syncAll(org: string) {
    const accounts = await prisma.bankAccount.findMany({ where: { org, provider: { in: bankProviders().map((p) => p.id) } } });
    const out: Array<{ account: string; name: string; provider: string; ok: boolean; imported?: number; message?: string }> = [];
    for (const a of accounts) {
        try {
            const r = await syncAccount(org, a);
            out.push({ account: a.id, name: a.name, provider: a.provider, ok: true, imported: r.imported });
        } catch (e) {
            out.push({ account: a.id, name: a.name, provider: a.provider, ok: false, message: (e as Error).message.slice(0, 200) });
        }
    }
    return out;
}
