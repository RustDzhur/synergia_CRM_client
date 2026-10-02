import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, unauthorized, validId } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { decryptJSON } from "@/lib/crypto";
import { privatBalance, privatStatement, privatSyncWindow } from "@/lib/banks/privatbank";
import { finishBankSync, linkBankAccount } from "@/lib/banks/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/bank/privatbank — выписка ПриватБанка по АПІ «Автоклієнт» (Приват24 для бізнесу).
//
// Действия: link / sync / unlink.

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: Request) {
    try {
        const user = await requireUser(req);
        if (!user) return unauthorized(req);
        const b = await req.json().catch(() => null);
        const action = str(b?.action, 20);

        if (action === "link") {
            const id = str(b?.id, 100);
            const token = str(b?.token, 300);
            const iban = str(b?.iban, 40).toUpperCase().replace(/\s/g, "");
            if (!id || !token) return badRequest("Вкажіть id і token із кабінету otp24.privatbank.ua");
            if (!/^UA\d{27}$/.test(iban)) return badRequest("IBAN має вигляд UA та 27 знаків — скопіюйте його з кабінету банку");
            // Проверяем подключение до сохранения: баланс по счёту отвечает только при верных id+token+IBAN
            const balance = await privatBalance({ id, token }, iban);
            const doc = await linkBankAccount(user.id, {
                provider: "privatbank",
                providerAccountId: balance.account,
                name: str(b?.name, 100),
                iban: balance.account,
                currency: balance.currency || "UAH",
                secret: { id, token },
            });
            const author = await prisma.user.findUnique({ where: { id: user.userId }, select: { firstname: true, lastname: true } });
            await logAudit({
                org: user.id,
                userName: author ? `${author.firstname} ${author.lastname}`.trim() : "—",
                action: "bank.privatbank_linked",
                entityType: "bankaccount",
                entityId: doc.id,
                summary: `Linked PrivatBank account ${balance.account.slice(-4)}`,
            });
            return NextResponse.json({ id: doc.id, name: doc.name, balance: balance.balance, currency: balance.currency }, { status: 201 });
        }

        if (action === "unlink") {
            const accountId = str(b?.accountId, 40);
            if (!validId(accountId)) return badRequest("accountId is required");
            const doc = await prisma.bankAccount.findFirst({ where: { id: accountId, org: user.id, provider: "privatbank" } });
            if (!doc) return badRequest("Account not found");
            await prisma.bankAccount.update({ where: { id: doc.id }, data: { provider: "", providerAccountId: "", providerSecret: "", providerSyncAt: null } });
            return NextResponse.json({ ok: true });
        }

        if (action === "sync") {
            const accountId = str(b?.accountId, 40);
            if (!validId(accountId)) return badRequest("accountId is required");
            const doc = await prisma.bankAccount.findFirst({ where: { id: accountId, org: user.id, provider: "privatbank" } });
            if (!doc) return badRequest("Account not found");
            const { id, token } = decryptJSON<{ id?: string; token?: string }>(doc.providerSecret) ?? {};
            if (!id || !token) return badRequest("Ключі не збережено — прив'яжіть рахунок заново");
            const { from, to } = privatSyncWindow(doc.providerSyncAt);
            const rows = await privatStatement({ id, token }, doc.providerAccountId as string, from, to);
            const result = await finishBankSync(user.id, doc as never, rows.map((r) => ({ date: r.date, amount: r.amount, counterparty: r.counterparty, reference: r.reference, externalId: `privat:${r.externalId}` })), to);
            return NextResponse.json({ imported: result.created.length, suggestions: result.suggestions, from: new Date(from * 1000).toISOString().slice(0, 10), to: new Date(to * 1000).toISOString().slice(0, 10) });
        }

        return badRequest("action must be link, sync or unlink");
    } catch (e) {
        return failure(e);
    }
}
