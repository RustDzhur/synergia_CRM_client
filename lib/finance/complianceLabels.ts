// Человеческие подписи кодов чек-листа реквизитов (lib/finance/compliance). Сервер отвечает кодами
// (seller_ua_id, signer…), интерфейс показывает их словами и говорит, где заполнить — иначе человек
// видит «act: seller_ua_id, ua_vat_certificate, signer» и не понимает, что от него хотят.
// Файл чистый и общий для браузера: словарь на трёх языках, как LABELS в lib/finance/pdf.ts.

const LABELS: Record<string, Record<string, string>> = {
    en: {
        seller_name: "your firm's name is not filled in",
        seller_tax_id: "your firm's tax number (USt-IdNr./tax ID) is not filled in",
        seller_ua_id: "your firm's ЄДРПОУ or ІПН is not filled in",
        ua_vat_certificate: "the VAT payer certificate number is not filled in",
        signer: "the document signer (full name) is not filled in",
        buyer_name: "the client is not specified",
        number: "the document number is missing",
        issue_date: "the document date is missing",
        supply_date: "the service date is missing",
        currency: "the currency is missing",
        items: "the document has no lines",
        line_fields: "a line is missing quantity, price or tax rate",
        gross: "the document total is zero",
        start_date: "the contract start date is missing",
        value: "the contract value is not filled in",
    },
    de: {
        seller_name: "der Firmenname fehlt",
        seller_tax_id: "die Steuernummer/USt-IdNr. der Firma fehlt",
        seller_ua_id: "ЄДРПОУ bzw. ІПН der Firma fehlt",
        ua_vat_certificate: "die Nummer der Umsatzsteuer-Registrierung fehlt",
        signer: "der Unterzeichner (Name) fehlt",
        buyer_name: "der Kunde ist nicht angegeben",
        number: "die Dokumentnummer fehlt",
        issue_date: "das Dokumentdatum fehlt",
        supply_date: "das Leistungsdatum fehlt",
        currency: "die Währung fehlt",
        items: "das Dokument hat keine Positionen",
        line_fields: "einer Position fehlt Menge, Preis oder Steuersatz",
        gross: "der Dokumentbetrag ist null",
        start_date: "das Vertragsbeginn-Datum fehlt",
        value: "der Vertragswert ist nicht gefüllt",
    },
    ua: {
        seller_name: "не заповнена назва вашої фірми",
        seller_tax_id: "не заповнений податковий номер фірми (USt-IdNr./ЄДРПОУ)",
        seller_ua_id: "не заповнений ЄДРПОУ або ІПН фірми",
        ua_vat_certificate: "не заповнений номер свідоцтва платника ПДВ",
        signer: "не заповнений підписант документів (ПІБ)",
        buyer_name: "не вказаний клієнт",
        number: "немає номера документа",
        issue_date: "немає дати документа",
        supply_date: "немає дати надання послуг",
        currency: "не вказана валюта",
        items: "у документі немає жодної позиції",
        line_fields: "у позиції бракує кількості, ціни або ставки",
        gross: "сума документа нульова",
        start_date: "немає дати початку договору",
        value: "не заповнена сума договору",
    },
};

// Где это заполняется — одной строкой, чтобы человек знал, куда идти
const WHERE: Record<string, string> = {
    en: "Fill it in under Налаштування → Бухгалтерія (firm details) and issue the document again.",
    de: "Ausfülbar unter Налаштування → Бухгалтерія (Firmendaten) — danach das Dokument erneut ausstellen.",
    ua: "Заповніть у Налаштуваннях → Бухгалтерія (реквізити фірми) і випустіть документ ще раз.",
};

/** «Не випускається: не заповнена назва фірми; не заповнений підписант (ПІБ). Заповніть …» */
export function explainCompliance(codes: string[], locale: string): string {
    const lang = LABELS[locale] ? locale : "ua";
    const words = codes.map((c) => LABELS[lang][c] ?? c);
    return `${words.join("; ")}. ${WHERE[lang]}`;
}
