import { marketOf } from "../market";

// Чек-листы обязательных реквизитов (ТЗ §14): пока чего-то нет, документ не выпускается, и причина
// видна человеку — списком кодов, которые интерфейс переводит. Это не «валидация формы ради формы»:
// каждый пункт — требование §14 UStG (Германия) или Закону про бухоблік і ПКУ (Украина), а помеченные
// [проверить] стоит подтвердить с бухгалтером. Проверки чистые: документ, настройки и рынок на входе.

export interface ComplianceIssue {
    code: string; // код для перевода (comp_* в messages)
    section: "seller" | "buyer" | "document" | "lines" | "tax";
}

export interface ComplianceDoc {
    kind: "invoice" | "credit_note" | "quote" | "order" | "contract" | "delivery_note" | "act" | "packing_list";
    number?: string;
    issueDate?: string;
    dueDate?: string;
    supplyDate?: string;
    supplyPeriodFrom?: string;
    supplyPeriodTo?: string;
    startDate?: string;
    endDate?: string;
    currency?: string;
    value?: number;
    party: { name?: string; address?: string };
    items: Array<{ description?: string; qty?: number; unitPrice?: number; taxRate?: number | null }>;
    totals?: { gross?: number };
}

export interface ComplianceSeller {
    legalName?: string;
    taxId?: string;
    vatId?: string;
    uaEdrpou?: string;
    uaIpn?: string;
    uaVatPayer?: boolean;
    uaVatCertificate?: string;
    uaSignerName?: string;
    managingDirector?: string;
    uaIban?: string;
    country?: string;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const has = (v?: string | null) => typeof v === "string" && v.trim() !== "";

/** Что обязательно для документа: набор кодов, которые должны быть заполнены. */
export function checkCompliance(doc: ComplianceDoc, seller: ComplianceSeller, marketArg?: "DE" | "UA"): ComplianceIssue[] {
    const market = marketArg ?? marketOf(seller.country) ?? "DE";
    const issues: ComplianceIssue[] = [];
    const need = (ok: boolean, code: string, section: ComplianceIssue["section"]) => {
        if (!ok) issues.push({ code, section });
    };

    // Стороны
    need(has(seller.legalName), "seller_name", "seller");
    need(has(doc.party?.name), "buyer_name", "buyer");

    // Номер и даты — общие требования обеих стран
    // Номер проверяем там, где его вводит человек (счёт, предложение). Акт, накладная и упаковочный
    // лист получают номер от системы в момент выпуска — проверять пустое поле было бы отказом ни за что.
    const numbered = doc.kind !== "packing_list" && doc.kind !== "act" && doc.kind !== "delivery_note";
    need(!numbered || has(doc.number), "number", "document");
    need(!numbered || DATE.test(doc.issueDate ?? ""), "issue_date", "document");

    // Налоговые реквизиты продавца
    if (market === "DE") {
        need(has(seller.taxId) || has(seller.vatId), "seller_tax_id", "tax");
        // §14 Abs. 4 Nr. 6 UStG: дата или период оказания услуги — реквизит счёта
        if (doc.kind === "invoice" || doc.kind === "credit_note") {
            need(DATE.test(doc.supplyDate ?? "") || (DATE.test(doc.supplyPeriodFrom ?? "") && DATE.test(doc.supplyPeriodTo ?? "")), "supply_date", "document");
        }
    } else {
        // Идентификатор продавца: ЄДРПОУ/ІПН из украинского профиля или общий налоговый номер (taxId) —
        // PDF печатает первый непустой из них (lib/finance/document.ts), чек-лист не должен быть строже
        need(has(seller.uaEdrpou) || has(seller.uaIpn) || has(seller.taxId), "seller_ua_id", "tax");
        // Платник ПДВ выписывает податкову накладну — без номера свідоцтва реквизиты неполные
        if (seller.uaVatPayer && (doc.kind === "invoice" || doc.kind === "act")) {
            need(has(seller.uaVatCertificate), "ua_vat_certificate", "tax");
        }
        // Первичные документы подписывают: акт и видаткова без подписанта недействительны
        if (doc.kind === "act" || doc.kind === "delivery_note") {
            need(has(seller.uaSignerName) || has(seller.managingDirector), "signer", "seller");
        }
    }

    // Реквизиты для оплаты: срок выводится из настроек, если не задан, но валюта должна быть
    if (doc.kind === "invoice") {
        need(has(doc.currency), "currency", "document");
    }

    // Позиции: количество и цена осмысленны, ставка налога задана (0 — законное значение)
    if (doc.kind !== "contract") {
        need((doc.items?.length ?? 0) > 0, "items", "lines");
        const badLine = (doc.items ?? []).find((it) => !(Number(it.qty) > 0) || Number(it.unitPrice) < 0 || it.taxRate === null || it.taxRate === undefined);
        need(!badLine, "line_fields", "lines");
        if (doc.kind !== "packing_list" && doc.kind !== "delivery_note" && doc.kind !== "act" && doc.kind !== "credit_note") {
            need(Number(doc.totals?.gross) > 0, "gross", "lines");
        }
    }

    // Договор: срок и сумма
    if (doc.kind === "contract") {
        need(DATE.test(doc.startDate ?? ""), "start_date", "document");
        need(Number(doc.value) > 0, "value", "document");
    }

    return issues;
}

/** Человекочитаемое сообщение для сервера: коды перечислены, текст полностью — в переводах интерфейса. */
export function complianceMessage(issues: ComplianceIssue[]): string {
    return `Document is missing required fields: ${issues.map((i) => i.code).join(", ")}`;
}

/** Ошибка чек-листа: маршруты отвечают 400 и списком кодов — интерфейс переводит их сам. */
export class ComplianceError extends Error {
    constructor(public issues: ComplianceIssue[]) {
        super(complianceMessage(issues));
    }
}

/** Проверить и бросить: вызывается перед выпуском документа. */
export function assertCompliant(doc: ComplianceDoc, seller: ComplianceSeller, market?: "DE" | "UA"): void {
    const issues = checkCompliance(doc, seller, market);
    if (issues.length) throw new ComplianceError(issues);
}
