import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, unauthorized, validId } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { encryptJSON, decryptJSON } from "@/lib/crypto";
import { monobankClient, monobankStatement, syncWindow } from "@/lib/banks/monobank";
import { importBankRows } from "@/lib/finance/bankImport";
import { orgMarket } from "@/lib/finance/marketGuard";
import BankAccount from "@/models/BankAccount";
import User from "@/models/User";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET/POST /api/bank/monobank — выписка по API monobank (ТЗ «Банки і каса»).
//
// Действия:
//   { action: "connect", token }                  — проверить токен и показать счета банка (ничего не сохранено)
//   { action: "link", token, accountId, name? }   — привязать счёт CRM к счёту банка (токен шифруется)
//   { action: "sync", accountId }                 — забрать движения с прошлой синхронизации (или за месяц)
//   { action: "unlink", accountId }               — отвязать (движения остаются, привязка снимается)
//
// Токен берётся в кабинете api.monobank.ua (у ФОП там же и счета ФОП). Он хранится зашифрованным
// (lib/crypto.ts) и в браузер не отдаётся — интерфейс видит только имя и последние цифры IBAN.

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// Счёт банка в интерфейсе: без токена и без полного IBAN
const accountDTO = (a: { id: string; name: string; currency: string; balance: number; iban: string }) => ({
    id: a.id,
    name: a.name,
    currency: a.currency,
    balance: a.balance,
    ibanTail: a.iban.slice(-4),
});

export async function POST(req: Request) {
    try {
        const user = await requireUser(req);
        if (!user) return unauthorized(req);
        const b = await req.json().catch(() => null);
        const action = str(b?.action, 20);
        await connectDB();

        // Токен принимаем только для connect/link; для sync/unlink он уже лежит на счёте
        if (action === "connect") {
            const token = str(b?.token, 300);
            const client = await monobankClient(token);
            return NextResponse.json({ clientId: client.clientId, name: client.name, accounts: client.accounts.map(accountDTO) });
        }

        if (action === "link") {
            const token = str(b?.token, 300);
            const providerAccountId = str(b?.providerAccountId, 60);
            if (!providerAccountId) return badRequest("providerAccountId is required");
            // Клиент тянем ещё раз: имя счёта и валюта берутся из банка, а не из формы
            const client = await monobankClient(token);
            const bank = client.accounts.find((a) => a.id === providerAccountId);
            if (!bank) return badRequest("У цьому кабінеті monobank такого рахунку немає");
            let name = str(b?.name, 100) || `monobank · ${bank.iban.slice(-4) || bank.kind}`;
            const market = (await orgMarket(user.id)) ?? "UA";
            // Повторная привязка того же счёта банка обновляет существующую запись, а не плодит двойников
            const existing = await BankAccount.findOne({ org: user.id, provider: "monobank", providerAccountId });
            // Имя счёта уникально в фирме: второй счёт с тем же именем получает хвост номера
            if (!existing && (await BankAccount.exists({ org: user.id, name }))) name = `${name} ${providerAccountId.slice(-4)}`;
            const doc = existing ?? new BankAccount({ org: user.id, market, kind: "bank", name });
            doc.set({
                market,
                name: existing ? doc.name : name,
                iban: bank.iban,
                currency: bank.currency || "UAH",
                provider: "monobank",
                providerAccountId,
                providerSecret: encryptJSON({ token }),
            });
            await doc.save();
            const author = await User.findById(user.userId).select("firstname lastname");
            await logAudit({
                org: user.id,
                userName: author ? `${author.firstname} ${author.lastname}`.trim() : "—",
                action: "bank.monobank_linked",
                entityType: "bankaccount",
                entityId: String(doc._id),
                summary: `Linked monobank account ${providerAccountId}`,
            });
            return NextResponse.json({ id: String(doc._id), name: doc.name }, { status: 201 });
        }

        if (action === "unlink") {
            const accountId = str(b?.accountId, 40);
            if (!validId(accountId)) return badRequest("accountId is required");
            const doc = await BankAccount.findOne({ _id: accountId, org: user.id, provider: "monobank" });
            if (!doc) return badRequest("Account not found");
            doc.set({ provider: "", providerAccountId: "", providerSecret: "", providerSyncAt: undefined });
            await doc.save();
            return NextResponse.json({ ok: true });
        }

        if (action === "sync") {
            const accountId = str(b?.accountId, 40);
            if (!validId(accountId)) return badRequest("accountId is required");
            const doc = await BankAccount.findOne({ _id: accountId, org: user.id, provider: "monobank" });
            if (!doc) return badRequest("Account not found");
            const { token } = decryptJSON<{ token?: string }>(doc.providerSecret) ?? {};
            if (!token) return badRequest("Токен не збережено — прив'яжіть рахунок заново");
            // Окно: с прошлой синхронизации (или за месяц при первой) — выписка за годы не нужна
            const { from, to } = syncWindow(doc.providerSyncAt, doc.openingDate ?? "");
            const rows = await monobankStatement(token, doc.providerAccountId as string, from, to);
            const result = await importBankRows(user.id, doc, rows.map((r) => ({ date: r.date, amount: r.amount, counterparty: r.counterparty, reference: r.reference, externalId: `mono:${r.externalId}` })), "auto");
            doc.providerSyncAt = new Date(to * 1000);
            await doc.save();
            return NextResponse.json({ imported: result.created.length, suggestions: result.suggestions, from: new Date(from * 1000).toISOString().slice(0, 10), to: new Date(to * 1000).toISOString().slice(0, 10) });
        }

        return badRequest("action must be connect, link, sync or unlink");
    } catch (e) {
        return failure(e);
    }
}
