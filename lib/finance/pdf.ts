import PDFDocument from "pdfkit";
import notoSansUrl from "@/assets/fonts/NotoSans-Regular.ttf";
import { renderLayout } from "./layouts";
import { marketOf } from "./market";
import { uzDocumentLabels } from "./pdfLabelsUz";
export { TEMPLATES, TEMPLATE_IDS, isTemplate, templateDef } from "./templates";
export type { TemplateDef, TemplateVariant } from "./templates";

// Данные шрифта из data-URI — см. scripts/ttf-data-uri-loader.js и правило webpack в next.config.js. Шрифт встроен
// в бандл, поэтому рендер PDF не зависит от файлов node_modules: иначе pdfkit для своей встроенной гарнитуры
// Helvetica лениво грузит node_modules/pdfkit/js/standard-fonts/*, которых в функциях на Vercel нет, и генерация
// падала с "Cannot find module '#standard-fonts/Helvetica'". Noto Sans заодно покрывает кириллицу и знаки €/₴/№,
// которых у Helvetica нет.
// Экспортируется: печать складских документов (lib/finance/stockDocPdf.ts) собирает свой простой PDF
// тем же встроенным шрифтом, чтобы кириллица и ₴ печатались одинаково во всех документах
export const DOC_FONT = Buffer.from(notoSansUrl.slice(notoSansUrl.indexOf(",") + 1), "base64");

// Какие бумаги рисует этот файл. Счёт и кредит-нота жили здесь и раньше, предложение/заказ/договор добавлены,
// чтобы каждый финансовый документ можно было и скачать, и отправить клиенту одним и тем же рендером.
export type DocKind = "invoice" | "credit_note" | "quote" | "order" | "contract" | "delivery_note" | "act" | "packing_list";

// Небольшой словарь подписей PDF на трёх языках интерфейса — сам PDFKit не знает про next-intl (это не React-рендер),
// поэтому подписи держим здесь же, минимальным набором, без обращения к messages/*.json.
const LABELS: Record<string, Record<string, string>> = {
    en: {
        invoice: "Invoice", credit_note: "Credit Note", quote: "Quotation", order: "Order confirmation", contract: "Contract",
        delivery_note: "Delivery note", packing_list: "Packing list", deliveryDate: "Delivery date", ourOrder: "Our order",
        level_1: "Payment reminder", level_2: "First reminder", level_3: "Second reminder", level_4: "Final reminder",
        creditFor: "Credit note for invoice",
        billTo: "Bill to", issueDate: "Issue date", dueDate: "Due date", date: "Date", orderDate: "Order date",
        supplyDate: "Service date", supplyPeriod: "Service period",
        dunningLevel: "Payment reminder", dunningFee: "Reminder fee", dunningNewDue: "New payment date",
        validUntil: "Valid until", startDate: "Start date", endDate: "End date", contractValue: "Contract value",
        description: "Description", qty: "Qty", unitPrice: "Unit price", tax: "Tax", lineTotal: "Total",
        net: "Net", taxTotal: "Tax", gross: "Total", taxOn: "on",
        smallBusiness: "No VAT is charged pursuant to the small business regulation (§19 UStG or equivalent).",
        paymentTerms: "Payment terms", days: "days", iban: "IBAN", bic: "BIC", notes: "Notes",
        seller: "Seller", payByQr: "Pay by QR code", qrHint: "Scan with your banking app",
        uahTotal: "Total in UAH", uahRate: "rate",
        act: "Certificate of services", actDate: "Service date", actFor: "for invoice",
        signedBy: "Contractor", signedByCustomer: "Customer",
        issuedBy: "Issued by", receivedBy: "Received by",
        hsCode: "HS code", weightKg: "Weight, kg", origin: "Origin", totalWeight: "Total weight", packingDate: "Packing date",
        continued: "continued",
    },
    de: {
        invoice: "Rechnung", credit_note: "Gutschrift", quote: "Angebot", order: "Auftragsbestätigung", contract: "Vertrag",
        delivery_note: "Lieferschein", packing_list: "Packliste", deliveryDate: "Lieferdatum", ourOrder: "Unsere Bestellung",
        level_1: "Zahlungserinnerung", level_2: "1. Mahnung", level_3: "2. Mahnung", level_4: "Letzte Mahnung",
        creditFor: "Gutschrift zur Rechnung",
        billTo: "Rechnungsempfänger", issueDate: "Rechnungsdatum", dueDate: "Fällig am", date: "Datum", orderDate: "Bestelldatum",
        supplyDate: "Leistungsdatum", supplyPeriod: "Leistungszeitraum",
        dunningLevel: "Zahlungserinnerung", dunningFee: "Mahngebühr", dunningNewDue: "Neues Zahlungsziel",
        validUntil: "Gültig bis", startDate: "Beginn", endDate: "Ende", contractValue: "Vertragswert",
        description: "Beschreibung", qty: "Menge", unitPrice: "Einzelpreis", tax: "USt.", lineTotal: "Summe",
        net: "Netto", taxTotal: "USt.", gross: "Gesamt", taxOn: "auf",
        smallBusiness: "Gemäß §19 UStG (Kleinunternehmerregelung) wird keine Umsatzsteuer berechnet.",
        paymentTerms: "Zahlungsziel", days: "Tage", iban: "IBAN", bic: "BIC", notes: "Anmerkungen",
        seller: "Verkäufer", payByQr: "Zahlung per QR-Code", qrHint: "Mit der Banking-App scannen",
        uahTotal: "Gesamt in UAH", uahRate: "Kurs",
        act: "Leistungsnachweis", actDate: "Leistungsdatum", actFor: "zur Rechnung",
        signedBy: "Auftragnehmer", signedByCustomer: "Auftraggeber",
        issuedBy: "Ausgeliefert von", receivedBy: "Erhalten von",
        hsCode: "Zolltarifnr.", weightKg: "Gewicht, kg", origin: "Herkunft", totalWeight: "Gesamtgewicht", packingDate: "Packdatum",
        continued: "Fortsetzung",
    },
    ua: {
        invoice: "Рахунок", credit_note: "Кредит-нота", quote: "Комерційна пропозиція", order: "Підтвердження замовлення", contract: "Договір",
        delivery_note: "Видаткова накладна", packing_list: "Пакувальний лист", deliveryDate: "Дата поставки", ourOrder: "Наше замовлення",
        level_1: "Нагадування про оплату", level_2: "1-ше нагадування", level_3: "2-ге нагадування", level_4: "Останнє нагадування",
        creditFor: "Кредит-нота до рахунку",
        billTo: "Платник", issueDate: "Дата виставлення", dueDate: "Термін оплати", date: "Дата", orderDate: "Дата замовлення",
        supplyDate: "Дата надання послуг", supplyPeriod: "Період надання послуг",
        dunningLevel: "Нагадування про оплату", dunningFee: "Плата за нагадування", dunningNewDue: "Новий строк оплати",
        validUntil: "Дійсний до", startDate: "Початок", endDate: "Завершення", contractValue: "Сума договору",
        description: "Опис", qty: "К-сть", unitPrice: "Ціна", tax: "ПДВ", lineTotal: "Сума",
        net: "Нетто", taxTotal: "ПДВ", gross: "Разом", taxOn: "на",
        smallBusiness: "ПДВ не нараховується згідно з режимом для малого підприємця (§19 UStG або аналог).",
        paymentTerms: "Термін оплати", days: "днів", iban: "IBAN", bic: "BIC", notes: "Примітки",
        seller: "Постачальник", payByQr: "Оплата за QR-кодом", qrHint: "Скануйте у банківському застосунку",
        uahTotal: "Разом у гривні", uahRate: "курс",
        act: "Акт виконаних робіт", actDate: "Дата складання", actFor: "до рахунку",
        signedBy: "Виконавець", signedByCustomer: "Замовник",
        issuedBy: "Видав", receivedBy: "Отримав",
        hsCode: "УКТ ЗЕД", weightKg: "Вага, кг", origin: "Країна", totalWeight: "Загальна вага", packingDate: "Дата пакування",
        continued: "продовження",
    },
};

export interface PdfLineItem {
    description: string; qty: number; unitPrice: number; taxRate: number;
    // Упаковочный лист (ВЭД): код УКТ ЗЕД/HS, вес единицы и страна происхождения — печатаются своими колонками
    unit?: string; // единица измерения (обязательна в ЭСФ Узбекистана): печатается рядом с количеством
    hsCode?: string;
    unitWeightKg?: number;
    originCountry?: string;
}
export interface PdfParty { name: string; address?: string; taxId?: string }
export interface PdfDocumentData {
    kind: DocKind;
    number: string;
    // Курс к гривне: у счёта в валюте печатается и сумма в ₴ (НБУ плюс наценка фирмы).
    // Здесь именно данные, а не настройки: строка попадает в те же итоги, что и остальные суммы.
    uahRate?: { rate: number; base: number; margin: number; at: string; home?: string } | null;
    orderNumber?: string; // накладная: номер заказа, по которому она выписана
    creditForNumber?: string; // для kind "credit_note" — номер исправляемого счёта
    customer: PdfParty;
    items: PdfLineItem[]; // у договора позиций нет — вместо таблицы печатается сумма договора
    currency: string;
    smallBusinessNote?: boolean;
    issueDate?: string;
    supplyDate?: string; // дата поставки/услуги (§14 Abs. 4 Nr. 6 UStG) — обязательна в немецком счёте
    supplyPeriodFrom?: string; // если услуга оказывалась периодом: начало
    supplyPeriodTo?: string; // и конец
    dunningLevel?: number; // 0 — обычный счёт, 1..4 — напоминание соответствующей ступени
    dunningFee?: number; // начисленные сборы за напоминания, без налога
    dunningNewDue?: string; // новый срок оплаты, который даёт напоминание
    dueDate?: string; // счёт
    validUntil?: string; // предложение
    startDate?: string; // договор
    endDate?: string;
    value?: number; // договор: сумма договора
    body?: string; // договор: текст пунктов с подставленными значениями (lib/finance/contractText.ts)
    notes?: string;
    contractNumber?: string; // номер договора: в украинских документах его печатают рядом с датой
    template?: string; // id шаблона оформления; если не задан — берётся умолчание из настроек бухгалтерии
}
export interface PdfSettings {
    legalName: string; address: string; taxId: string; iban: string; bic: string; paymentTermsDays: number;
    vatId?: string; // USt-IdNr. — отдельная строка, на немецком счёте печатается вместе с налоговым номером
    logo?: string; // data-URL логотипа фирмы из настроек
    phone?: string; email?: string; website?: string; // контактная строка в шапке
    registerNumber?: string; // Handelsregister / ЄДРПОУ и т.п.
    footerText?: string; // свой текст внизу документа: благодарность, условия, реквизиты
    managingDirector?: string; // подпись/руководитель, как принято в немецких документах
    template?: string; // шаблон оформления по умолчанию для новых документов
    paymentQr?: boolean; // печатать ли QR-код на оплату в счетах
    country?: string; // ISO-код страны фирмы: у UA-фирмы документы называются по-украински
    // Украинские реквизиты и подписант: печатаются рядом с обычными, если фирма их заполнила
    bank?: string; // название банка
    uaSigner?: { name: string; position: string }; // подписант документов (ФОП или директор ТОВ)
    signature?: string; // data-URL изображения подписи
    seal?: string; // data-URL изображения печати
    showSignature?: boolean; // ставить ли изображение подписи в акте/накладной
    showStamp?: boolean; // ставить ли изображение печати
    // Тексты из настраиваемого бланка (DocumentTemplate): условия оплаты, примечания и подвал
    // документа. Пусто — печатаются значения по умолчанию из настроек фирмы.
    texts?: { paymentTerms?: string; notes?: string; footer?: string };
}


// ── Украинские подписи ───────────────────────────────────────────────────────────────────────────────
// Документы украинской фирмы называются и подписываются по-украински независимо от языка интерфейса:
// счёт-фактура остаётся рахунком-фактурою, даже если бухгалтер смотрит кабинет на немецком.
// Названия — принятые в учёте: рахунок-фактура, видаткова накладна, акт, товарно-транспортна накладна.
const UA_LABELS: Record<string, string> = {
    invoice: "Рахунок-фактура",
    credit_note: "Рахунок-коригування",
    quote: "Комерційна пропозиція",
    order: "Замовлення",
    contract: "Договір",
    delivery_note: "Видаткова накладна",
    packing_list: "Пакувальний лист",
    deliveryDate: "Дата поставки",
    ourOrder: "Наше замовлення",
    level_1: "Нагадування про оплату",
    level_2: "1-ше нагадування",
    level_3: "2-ге нагадування",
    level_4: "Останнє нагадування",
    creditFor: "Рахунок-коригування до рахунку",
    billTo: "Покупець",
    issueDate: "Дата виставлення",
    dueDate: "Термін оплати",
    date: "Дата",
    orderDate: "Дата замовлення",
    supplyDate: "Дата надання послуг",
    supplyPeriod: "Період надання послуг",
    dunningLevel: "Нагадування про оплату",
    dunningFee: "Плата за нагадування",
    dunningNewDue: "Новий строк оплати",
    validUntil: "Дійсний до",
    startDate: "Початок",
    endDate: "Завершення",
    contractValue: "Сума договору",
    description: "Опис",
    qty: "К-сть",
    unitPrice: "Ціна",
    tax: "ПДВ",
    lineTotal: "Сума",
    // Итоги украинского документа — «Разом без ПДВ / ПДВ / До сплати» (ТЗ §7)
    net: "Разом без ПДВ",
    taxTotal: "ПДВ",
    gross: "До сплати",
    taxOn: "на",
    sumInWords: "Сума прописом",
    contractNo: "Договір",
    edrpou: "ЄДРПОУ",
    ipn: "ІПН",
    mfo: "МФО",
    bank: "Банк",
    vatCert: "Свідоцтво платника ПДВ",
    signerPosition: "посада",
    smallBusiness: "ПДВ не нараховується: фірма не є платником ПДВ.",
    paymentTerms: "Термін оплати",
    days: "днів",
    iban: "IBAN",
    bic: "МФО",
    notes: "Примітки",
    seller: "Постачальник",
    payByQr: "Оплата за QR-кодом",
    qrHint: "Скануйте у банківському застосунку",
    continued: "продовження",
    act: "Акт виконаних робіт",
    actDate: "Дата складання",
    actFor: "до рахунку",
    signedBy: "Виконавець",
    signedByCustomer: "Замовник",
    issuedBy: "Видав",
    receivedBy: "Отримав",
    hsCode: "УКТ ЗЕД",
    weightKg: "Вага, кг",
    origin: "Країна",
    totalWeight: "Загальна вага",
    packingDate: "Дата пакування",
    uahTotal: "Разом у гривні",
    uahRate: "курс",
};

// Рендерит PDF финансового документа в буфер — вызывается из app/api/*/[id]/pdf/route.ts (скачивание и печать)
// и из lib/finance/send.ts (вложение к письму клиенту). Сам рендер (десять шаблонов оформления) живёт в
// lib/finance/layouts.ts; здесь остаётся только создание документа с встроенным шрифтом и выбор языка подписей.
export function renderDocumentPdf(d: PdfDocumentData, settings: PdfSettings, locale = "en"): Promise<Buffer> {
    // Украинская фирма получает украинские названия документов независимо от языка интерфейса
    const base = LABELS[locale] ?? LABELS.en;
    const market = marketOf(settings.country);
    // Узбекская фирма: двуязычные подписи uz / ru (только русские — по явному запросу locale = "ru", только узбекские — "uz-only")
    const L = market === "UA" ? { ...base, ...UA_LABELS } : market === "UZ" ? { ...base, ...uzDocumentLabels(locale === "ru" ? "ru" : locale === "uz-only" ? "uz" : null) } : base;
    return new Promise((resolve, reject) => {
        // pdfkit принимает буфер шрифта в options.font (разбирает его fontkit), но в его типах там только имя шрифта
        const doc = new PDFDocument({ size: "A4", margin: 50, font: DOC_FONT as unknown as string });
        const chunks: Buffer[] = [];
        doc.on("data", (c: Buffer) => chunks.push(c));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        renderLayout(doc, d, settings, L);

        doc.end();
    });
}

// Обратная совместимость: счета и кредит-ноты рисовались этой функцией до того, как рендер стал общим.
// У счёта стороны — снимок на момент выставления (customerName/customerAddress/customerTaxId), а не ссылки.
export function renderInvoicePdf(
    inv: {
        number: string; kind: "invoice" | "credit_note"; creditForNumber?: string;
        customerName: string; customerAddress: string; customerTaxId: string;
        items: PdfLineItem[]; currency: string; smallBusinessNote: boolean; issueDate: string; dueDate: string; notes: string;
    },
    settings: PdfSettings,
    locale = "en"
): Promise<Buffer> {
    return renderDocumentPdf(
        {
            kind: inv.kind,
            number: inv.number,
            creditForNumber: inv.creditForNumber,
            customer: { name: inv.customerName, address: inv.customerAddress, taxId: inv.customerTaxId },
            items: inv.items ?? [],
            currency: inv.currency,
            smallBusinessNote: !!inv.smallBusinessNote,
            issueDate: inv.issueDate,
            dueDate: inv.dueDate,
            notes: inv.notes,
        },
        settings,
        locale
    );
}
