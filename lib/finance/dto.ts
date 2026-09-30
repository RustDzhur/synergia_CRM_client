// DTO-преобразования Order/Invoice/Quote/Contract — раньше жили как именованные экспорты прямо в соответствующих
// route.ts и импортировались оттуда в свои /[id]/... роуты. Next.js этого не допускает: файл route.ts может
// экспортировать только обработчики HTTP-методов и несколько служебных констант (dynamic, revalidate…) — любой другой
// именованный экспорт иногда ломает проверку типов при сборке ("does not match the required types of a Next.js Route"),
// как и написано в комментарии lib/crmFields.ts про поля форм. Работало по случайности — вынесено сюда, чтобы больше
// не работало по случайности.
import { computeTotals } from "./totals";
import { DOC_PRESETS } from "./documents/presets";

export const toOrderDTO = (o: any) => ({
    deliveryNoteNumber: o.deliveryNoteNumber ?? "", deliveryDate: o.deliveryDate ?? "",
    actNumber: o.actNumber ?? "", actDate: o.actDate ?? "",
    ukrposhta: o.ukrposhta?.barcode
        ? { uuid: o.ukrposhta.uuid ?? "", barcode: o.ukrposhta.barcode, status: o.ukrposhta.status ?? "", place: o.ukrposhta.place ?? "", postOffice: o.ukrposhta.postOffice ?? "", cod: o.ukrposhta.cod ?? 0, statusAt: o.ukrposhta.statusAt ? new Date(o.ukrposhta.statusAt).toISOString() : "" }
        : null,
    // Доставка «Новою Поштою»: номер ТТН и последний статус посылки (см. app/api/orders/[id]/waybill)
    waybill: o.waybill
        ? {
            number: o.waybill.number ?? "", ref: o.waybill.ref ?? "", status: o.waybill.status ?? "",
            statusAt: o.waybill.statusAt ? new Date(o.waybill.statusAt).toISOString() : "",
            cost: o.waybill.cost ?? 0, city: o.waybill.city ?? "", warehouse: o.waybill.warehouse ?? "",
            recipient: o.waybill.recipient ?? "", phone: o.waybill.phone ?? "", weight: o.waybill.weight ?? 0, cod: o.waybill.cod ?? 0,
            seats: o.waybill.seats ?? 1, street: o.waybill.street ?? "", house: o.waybill.house ?? "", flat: o.waybill.flat ?? "",
            returnNumber: o.waybill.returnNumber ?? "", returnAt: o.waybill.returnAt ? new Date(o.waybill.returnAt).toISOString() : "",
        }
        : null,
    id: String(o._id), number: o.number, status: o.status,
    contact: o.contact ? String(o.contact) : "", company: o.company ? String(o.company) : "", customerName: o.customerName,
    // телефон клиента — из связанного контакта (подставляется в окно ТТН), а не из заказа
    contactPhone: o.contactPhone ?? "",
    deal: o.deal ? String(o.deal) : "", contract: o.contract ? String(o.contract) : "",
    items: (o.items ?? []).map((it: any) => ({ description: it.description, qty: it.qty, unitPrice: it.unitPrice, taxRate: it.taxRate, product: it.product ? String(it.product) : "" })),
    currency: o.currency, notes: o.notes, responsible: o.responsible, template: o.template || "",
    invoice: o.invoice ? String(o.invoice) : "",
    totals: computeTotals(o.items ?? []),
    createdAt: o.createdAt.toISOString(), updatedAt: o.updatedAt.toISOString(),
});

export const toInvoiceDTO = (inv: any) => ({
    id: String(inv._id), number: inv.number, kind: inv.kind, creditFor: inv.creditFor ? String(inv.creditFor) : "",
    contact: inv.contact ? String(inv.contact) : "", company: inv.company ? String(inv.company) : "",
    customerName: inv.customerName, customerAddress: inv.customerAddress, customerTaxId: inv.customerTaxId,
    deal: inv.deal ? String(inv.deal) : "", order: inv.order ? String(inv.order) : "", contract: inv.contract ? String(inv.contract) : "",
    items: (inv.items ?? []).map((it: any) => ({ description: it.description, qty: it.qty, unitPrice: it.unitPrice, taxRate: it.taxRate, product: it.product ? String(it.product) : "" })),
    currency: inv.currency, smallBusinessNote: !!inv.smallBusinessNote,
    issueDate: inv.issueDate, dueDate: inv.dueDate, notes: inv.notes, template: inv.template || "",
    incoterms: inv.incoterms ?? "", customsDeclaration: inv.customsDeclaration ?? "",
    supplyDate: inv.supplyDate ?? "", supplyPeriodFrom: inv.supplyPeriodFrom ?? "", supplyPeriodTo: inv.supplyPeriodTo ?? "",
    status: inv.status, sentAt: inv.sentAt ? inv.sentAt.toISOString() : "", sentTo: inv.sentTo ?? "", paidAt: inv.paidAt ? inv.paidAt.toISOString() : "", paidAmount: inv.paidAmount,
    reminderCount: inv.reminderCount ?? 0, lastReminderAt: inv.lastReminderAt ? inv.lastReminderAt.toISOString() : "",
    dunningLevel: inv.dunningLevel ?? 0, dunningFee: inv.dunningFee ?? 0,
    dunningLog: (inv.dunningLog ?? []).map((e: any) => ({ level: e.level, sentAt: e.sentAt ? e.sentAt.toISOString() : "", fee: e.fee ?? 0, dueDate: e.dueDate ?? "", method: e.method ?? "" })),
    recurringSource: inv.recurringSource ? String(inv.recurringSource) : "",
    // Фискальный чек ПРРО: фискальный номер и ссылка для клиента (см. lib/finance/fiscal.ts)
    paidVia: inv.paidVia ?? "",
    payLink: inv.payLink?.url ? { provider: inv.payLink.provider ?? "", url: inv.payLink.url, id: inv.payLink.id ?? "" } : null,
    fiscal: inv.fiscalCode || inv.fiscalId || inv.fiscalError
        ? { code: inv.fiscalCode ?? "", url: inv.fiscalUrl ?? "", at: inv.fiscalAt ? new Date(inv.fiscalAt).toISOString() : "", error: inv.fiscalError ?? "" }
        : null,
    totals: computeTotals(inv.items ?? []),
    createdAt: inv.createdAt.toISOString(), updatedAt: inv.updatedAt.toISOString(),
});

export const toRecurringInvoiceDTO = (r: any) => ({
    id: String(r._id), active: !!r.active,
    contact: r.contact ? String(r.contact) : "", company: r.company ? String(r.company) : "",
    customerName: r.customerName, customerAddress: r.customerAddress, customerTaxId: r.customerTaxId,
    items: (r.items ?? []).map((it: any) => ({ description: it.description, qty: it.qty, unitPrice: it.unitPrice, taxRate: it.taxRate, product: it.product ? String(it.product) : "" })),
    currency: r.currency, notes: r.notes,
    interval: r.interval, dayOfMonth: r.dayOfMonth, autoSend: !!r.autoSend,
    nextRunDate: r.nextRunDate, lastRunAt: r.lastRunAt ? r.lastRunAt.toISOString() : "", lastInvoice: r.lastInvoice ? String(r.lastInvoice) : "",
    totals: computeTotals(r.items ?? []),
    createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
});

const toItemDTO = (it: any) => ({ description: it.description, qty: it.qty, unitPrice: it.unitPrice, taxRate: it.taxRate, product: it.product ? String(it.product) : "" });

export const toQuoteDTO = (q: any) => ({
    id: String(q._id), number: q.number, status: q.status,
    contact: q.contact ? String(q.contact) : "", company: q.company ? String(q.company) : "", customerName: q.customerName,
    deal: q.deal ? String(q.deal) : "", order: q.order ? String(q.order) : "",
    items: (q.items ?? []).map(toItemDTO),
    currency: q.currency, issueDate: q.issueDate, validUntil: q.validUntil, notes: q.notes, template: q.template || "",
    sentAt: q.sentAt ? q.sentAt.toISOString() : "", sentTo: q.sentTo ?? "",
    version: q.version ?? 1,
    versions: (q.versions ?? []).map((v: any) => ({
        version: v.version, customerName: v.customerName, currency: v.currency,
        items: (v.items ?? []).map(toItemDTO), totals: computeTotals(v.items ?? []),
        savedAt: v.savedAt ? v.savedAt.toISOString() : "",
    })),
    totals: computeTotals(q.items ?? []),
    createdAt: q.createdAt.toISOString(), updatedAt: q.updatedAt.toISOString(),
});

export const toContractDTO = (c: any) => ({
    id: String(c._id), number: c.number, status: c.status,
    contact: c.contact ? String(c.contact) : "", company: c.company ? String(c.company) : "", customerName: c.customerName,
    deal: c.deal ? String(c.deal) : "", value: c.value, currency: c.currency,
    startDate: c.startDate, endDate: c.endDate, notes: c.notes, template: c.template || "",
    signedAt: c.signedAt ? c.signedAt.toISOString() : "", file: c.file ? String(c.file) : "",
    createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString(),
});

// Бланк документа (DocumentTemplate) для интерфейса: блоки, тексты, префикс, подпись/печать.
// Живёт здесь, а не в route.ts: Next запрещает именованные экспорты из файлов маршрутов
// (см. комментарий в начале файла), и такой экспорт ломает проверку типов при сборке.
export const toTemplateDTO = (t: any) => ({
    id: String(t._id),
    market: t.market,
    kind: t.kind,
    name: t.name,
    blocks: Array.isArray(t.blocks) ? t.blocks : [],
    texts: { ua: t.texts?.ua ?? "", en: t.texts?.en ?? "", de: t.texts?.de ?? "", notes: t.texts?.notes ?? "" },
    prefix: t.prefix ?? "",
    numbering: { yearly: t.numbering?.yearly !== false, resetEachYear: t.numbering?.resetEachYear !== false },
    showStamp: !!t.showStamp,
    showSignature: !!t.showSignature,
    footer: t.footer ?? "",
    paymentTerms: t.paymentTerms ?? "",
    language: t.language === "en" || t.language === "de" ? t.language : "ua",
    currency: t.currency ?? "",
    active: t.active !== false,
    // ключ пресета — по нему окно предлагает «повернути бланк до пресета»; у своих бланков его нет
    presetKey: DOC_PRESETS.find((p) => p.market === t.market && p.kind === t.kind && p.name === t.name)?.key ?? "",
});
