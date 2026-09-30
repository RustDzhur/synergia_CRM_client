import type { Market } from "../market";

// Готовые бланки документов (ТЗ §7): «UA-рахунок», «UA-акт», «UA-видаткова», «DE-Rechnung» и т.д.
// Пресет — это образец: при первом открытии экрана «Документы» бланки копируются в базу фирмы,
// дальше правятся свободно и на пресет больше не оглядываются.
//
// Блоки: logo (логотип), qr (код оплаты), notes (примечания), footer (подвал), signature/печать
// (изображения uaSignature/uaSeal), rate (строка курса НБУ у валютного документа).
// У украинских бланков по умолчанию включены подпись и печать — их и ждут в актах и накладных.

export interface DocPreset {
    key: string; // стабильный идентификатор пресета (по нему возвращают исходный вид)
    market: Market;
    kind: string; // invoice | credit_note | act | delivery_note | quote | order | contract
    name: string;
    blocks: string[];
    texts: { ua: string; en: string; de: string }; // условия оплаты
    notes: { ua: string; en: string; de: string }; // примечания
    footer: string;
    prefix: string;
    showSignature: boolean;
    showStamp: boolean;
    language: "ua" | "en" | "de";
}

const empty = { ua: "", en: "", de: "" };

export const DOC_PRESETS: DocPreset[] = [
    {
        key: "ua-invoice",
        market: "UA",
        kind: "invoice",
        name: "UA-рахунок",
        blocks: ["logo", "qr", "notes", "footer", "rate"],
        texts: { ua: "Оплата протягом 5 днів з дня виставлення рахунку", en: "Payment within 5 days of the invoice date", de: "Zahlung innerhalb von 5 Tagen nach Rechnungsdatum" },
        notes: empty,
        footer: "",
        prefix: "РАХ",
        showSignature: false,
        showStamp: false,
        language: "ua",
    },
    {
        key: "ua-act",
        market: "UA",
        kind: "act",
        name: "UA-акт виконаних робіт",
        blocks: ["logo", "notes", "footer", "signature", "seal", "rate"],
        texts: empty,
        notes: { ua: "Послуги надані в повному обсязі, претензій немає", en: "Services were provided in full, no claims", de: "Leistungen vollständig erbracht, keine Beanstandungen" },
        footer: "",
        prefix: "АКТ",
        showSignature: true,
        showStamp: true,
        language: "ua",
    },
    {
        key: "ua-delivery",
        market: "UA",
        kind: "delivery_note",
        name: "UA-видаткова накладна",
        blocks: ["logo", "notes", "footer", "signature", "seal"],
        texts: empty,
        notes: empty,
        footer: "",
        prefix: "ВН",
        showSignature: true,
        showStamp: true,
        language: "ua",
    },
    {
        // Пакувальний лист — документ грузу для брокера: колонки УКТ ЗЕД/вага/країна друкує сам рендер,
        // а бланк задаёт свой номер (ПЛ), подписи тут не нужны
        key: "ua-packing",
        market: "UA",
        kind: "packing_list",
        name: "UA-пакувальний лист",
        blocks: ["logo", "notes", "footer"],
        texts: empty,
        notes: { ua: "Документ складно за даними замовлення; розбіжності з видатковою накладною не допускаються", en: "Compiled from the order data; discrepancies with the delivery note are not allowed", de: "Aus den Bestelldaten erstellt; Abweichungen zum Lieferschein sind nicht zulässig" },
        footer: "",
        prefix: "ПЛ",
        showSignature: false,
        showStamp: false,
        language: "ua",
    },
    {
        key: "ua-quote",
        market: "UA",
        kind: "quote",
        name: "UA-комерційна пропозиція",
        blocks: ["logo", "notes", "footer", "rate"],
        texts: empty,
        notes: empty,
        footer: "",
        prefix: "КП",
        showSignature: false,
        showStamp: false,
        language: "ua",
    },
    {
        key: "ua-credit",
        market: "UA",
        kind: "credit_note",
        name: "UA-рахунок-коригування",
        blocks: ["logo", "notes", "footer"],
        texts: empty,
        notes: empty,
        footer: "",
        prefix: "РК",
        showSignature: false,
        showStamp: false,
        language: "ua",
    },
    {
        key: "de-invoice",
        market: "DE",
        kind: "invoice",
        name: "DE-Rechnung",
        blocks: ["logo", "qr", "notes", "footer"],
        texts: { ua: "", en: "Payable within 14 days", de: "Zahlbar innerhalb von 14 Tagen" },
        notes: empty,
        footer: "",
        prefix: "RE",
        showSignature: false,
        showStamp: false,
        language: "de",
    },
    {
        key: "de-quote",
        market: "DE",
        kind: "quote",
        name: "DE-Angebot",
        blocks: ["logo", "notes", "footer"],
        texts: empty,
        notes: empty,
        footer: "",
        prefix: "AN",
        showSignature: false,
        showStamp: false,
        language: "de",
    },
    {
        key: "de-credit",
        market: "DE",
        kind: "credit_note",
        name: "DE-Gutschrift",
        blocks: ["logo", "notes", "footer"],
        texts: empty,
        notes: empty,
        footer: "",
        prefix: "GS",
        showSignature: false,
        showStamp: false,
        language: "de",
    },
    {
        key: "de-delivery",
        market: "DE",
        kind: "delivery_note",
        name: "DE-Lieferschein",
        blocks: ["logo", "notes", "footer"],
        texts: empty,
        notes: empty,
        footer: "",
        prefix: "LS",
        showSignature: false,
        showStamp: false,
        language: "de",
    },
];

export const presetsFor = (market: Market): DocPreset[] => DOC_PRESETS.filter((p) => p.market === market);
