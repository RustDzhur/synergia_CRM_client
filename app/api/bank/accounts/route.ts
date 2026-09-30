import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { balanceAt } from "@/lib/finance/bank";
import BankAccount from "@/models/BankAccount";
import { orgMarket } from "@/lib/finance/marketGuard";
import { defaultCurrency } from "@/lib/finance/settings";
import BankTransaction from "@/models/BankTransaction";

export const dynamic = "force-dynamic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// GET /api/bank/accounts — счета и кассы с остатком и числом несверенных движений.
// Остаток считается от остатка на начало плюс все движения: отдельного поля «текущий остаток» нет,
// иначе оно рано или поздно разошлось бы с самими движениями.
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    await connectDB();

    const url = new URL(req.url);
    const to = str(url.searchParams.get("to"), 10);
    // Режимы не смешиваются: фильтруем счета по рынку фирмы. Пустой рынок у старых записей —
    // это немецкие счета (поле появилось позже), украинская фирма их не видит.
    const market = (await orgMarket(user.id)) ?? "DE";
    const accounts = await BankAccount.find({ org: user.id, $or: [{ market }, { market: "" }, { market: { $exists: false } }] })
        .sort({ kind: 1, name: 1 })
        .limit(100);
    // Немецкой фирме пустой рынок старых записей подходит, украинской — нет: свои счета она заводит заново
    const visible = market === "DE" ? accounts : accounts.filter((a: { market?: string }) => a.market === market);

    const result = [];
    for (const account of visible) {
        const transactions = await BankTransaction.find({ org: user.id, account: account._id }).select("date amount matchType");
        result.push({
            id: String(account._id),
            kind: account.kind,
            name: account.name,
            iban: account.iban ?? "",
            currency: account.currency ?? "EUR",
            openingBalance: account.openingBalance ?? 0,
            openingDate: account.openingDate ?? "",
            active: account.active !== false,
            balance: balanceAt(account.openingBalance ?? 0, transactions as never, DATE.test(to) ? to : undefined),
            transactionCount: transactions.length,
            unmatched: transactions.filter((t) => !t.matchType).length,
        });
    }
    return NextResponse.json({ accounts: result });
}

// POST /api/bank/accounts — завести счёт в банке или кассу
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    const name = str(b?.name);
    if (!name) return badRequest("name is required");
    const kind = b?.kind === "cash" ? "cash" : "bank";

    await connectDB();
    const existing = await BankAccount.findOne({ org: user.id, name });
    if (existing) return badRequest("An account with this name already exists");

    const account = await BankAccount.create({
        org: user.id,
        // Счёт принадлежит режиму фирмы: украинская фирма не увидит немецких счетов (и наоборот)
        market: (await orgMarket(user.id)) ?? "DE",
        kind,
        name,
        iban: str(b?.iban, 40),
        bic: str(b?.bic, 20),
        currency: str(b?.currency, 6).toUpperCase() || (await defaultCurrency(user.id)),
        openingBalance: Number.isFinite(Number(b?.openingBalance)) ? Number(b?.openingBalance) : 0,
        openingDate: DATE.test(str(b?.openingDate, 10)) ? str(b?.openingDate, 10) : "",
    });
    return NextResponse.json({ id: String(account._id) }, { status: 201 });
}
