// DTO расхода для API и стора: все налоговые поля плюс совместимый documentDate (это Expense.date).
// Вынесен из route.ts: Next разрешает в route.ts только обработчики и служебные константы, а тот же
// DTO нужен и списку, и PATCH, и автоопределению.
export const toExpenseDTO = (e: any) => {
    // Строки, созданные в обход нового API (старые модули/импорт/тесты), имеют только amount:
    // не показываем им нулевые netto/brutto, а выводим суммы из amount и ставки.
    const taxRate = Number(e.taxRate) || 0;
    const netAmount = Number(e.netAmount) || Number(e.amount) || 0;
    const vatAmount = Number(e.vatAmount) || Math.round(((netAmount * taxRate) / 100) * 100) / 100;
    const grossAmount = Number(e.grossAmount) || Math.round((netAmount + vatAmount) * 100) / 100;
    return {
        id: e.id,
        vendor: e.vendor,
        category: e.category ?? "",
        categoryCode: e.categoryCode ?? "",
        subcategory: e.subcategory ?? "",
        amount: e.amount ?? 0,
        netAmount,
        grossAmount,
        vatAmount,
        taxRate,
        currency: e.currency,
        date: e.date ?? "",
        // documentDate — то же самое поле для клиентов, которые говорят на языке Beleg
        documentDate: e.date ?? "",
        paidDate: e.paidDate ?? "",
        documentNumber: e.documentNumber ?? "",
        vendorVatId: e.vendorVatId ?? "",
        vendorIban: e.vendorIban ?? "",
        inputVatDeductible: e.inputVatDeductible !== false,
        datevAccount: e.datevAccount ?? "",
        datevChart: e.datevChart === "SKR04" ? "SKR04" : "SKR03",
        bookingKind: e.bookingKind ?? "Betriebsausgabe",
        afaYears: e.afaYears ?? null,
        afaResidualValue: e.afaResidualValue ?? null,
        folder: e.folder ?? "",
        reviewStatus: e.reviewStatus ?? "REVIEW",
        confidence: Number(e.confidence) || 0,
        manualFields: Array.isArray(e.manualFields) ? e.manualFields : [],
        autoFields: e.autoFields ?? null,
        deal: e.deal ?? "",
        order: e.order ?? "",
        receipt: e.receipt ?? "",
        recurring: e.recurring ?? "",
        notes: e.notes ?? "",
        createdByName: e.createdByName ?? "",
        esf: e.esf ?? null,
        createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : e.createdAt ?? "",
        updatedAt: e.updatedAt instanceof Date ? e.updatedAt.toISOString() : e.updatedAt ?? "",
    };
};
