import { NextResponse } from "next/server";
import { withPartner } from "@/lib/partner/http";

export const dynamic = "force-dynamic";

// Песочница банка: готовые тестовые данные в формате интеграции — фирма, счёт, строки выписки и событие вебхука. Настоящих фирм здесь нет.
export const GET = withPartner(async (_req, { partner }) => NextResponse.json({
    note: "Test data only. No real firm data is available here.",
    firm: { name: "Test Firm Ltd", country: "UA", currency: "UAH" },
    account: { id: "test-account-1", iban: "UA000000000000000000000000000", currency: "UAH", provider: partner.bankProvider },
    statement: [
        { date: "2026-01-12", amount: 12000, counterparty: "Test Customer", reference: "Payment for invoice RAH-1", externalId: "test-1" },
        { date: "2026-01-13", amount: -450.5, counterparty: "Test Supplier", reference: "Office supplies", externalId: "test-2" },
    ],
    webhookEvent: { type: "statement.item", account: "test-account-1", item: { amount: 12000, currency: "UAH", reference: "Payment for invoice RAH-1" } },
}));
