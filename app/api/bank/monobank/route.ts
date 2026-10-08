import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, unauthorized, validId } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { monobankClient } from "@/lib/banks/monobank";
import { linkBankAccount } from "@/lib/banks/link";
import { BankSyncError, syncAccount } from "@/lib/banks/provider";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/bank/monobank — выписка по API monobank (ТЗ «Банки і каса»).
//
// Действия: connect / link / sync / unlink.

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
            const doc = await linkBankAccount(user.id, {
                provider: "monobank",
                providerAccountId,
                name: str(b?.name, 100),
                iban: bank.iban,
                currency: bank.currency || "UAH",
                secret: { token },
            });
            const author = await prisma.user.findUnique({ where: { id: user.userId }, select: { firstname: true, lastname: true } });
            await logAudit({
                org: user.id,
                userName: author ? `${author.firstname} ${author.lastname}`.trim() : "—",
                action: "bank.monobank_linked",
                entityType: "bankaccount",
                entityId: doc.id,
                summary: `Linked monobank account ${providerAccountId}`,
            });
            return NextResponse.json({ id: doc.id, name: doc.name }, { status: 201 });
        }

        if (action === "unlink") {
            const accountId = str(b?.accountId, 40);
            if (!validId(accountId)) return badRequest("accountId is required");
            const doc = await prisma.bankAccount.findFirst({ where: { id: accountId, org: user.id, provider: "monobank" } });
            if (!doc) return badRequest("Account not found");
            await prisma.bankAccount.update({ where: { id: doc.id }, data: { provider: "", providerAccountId: "", providerSecret: "", providerSyncAt: null } });
            return NextResponse.json({ ok: true });
        }

        if (action === "sync") {
            const accountId = str(b?.accountId, 40);
            if (!validId(accountId)) return badRequest("accountId is required");
            const doc = await prisma.bankAccount.findFirst({ where: { id: accountId, org: user.id, provider: "monobank" } });
            if (!doc) return badRequest("Account not found");
            try {
                return NextResponse.json(await syncAccount(user.id, doc));
            } catch (e) {
                if (e instanceof BankSyncError) return badRequest(e.message);
                throw e;
            }
        }

        return badRequest("action must be connect, link, sync or unlink");
    } catch (e) {
        return failure(e);
    }
}
