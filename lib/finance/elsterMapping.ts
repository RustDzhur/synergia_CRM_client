// ВНИМАНИЕ: файл сгенерирован — не редактируйте вручную.
// Генератор: scripts/generate-elster-mapping.mjs
// Источник строк EÜR/Kz: docs/ELSTER_CATEGORIES.csv (проект Bürokratie-Copilot, Vordruck 2025).
// Источник кодов CRM: lib/finance/expenseCategoryCatalog.json.
// Перегенерировать: node scripts/generate-elster-mapping.mjs --csv ../burokratie-copilot/docs/ELSTER_CATEGORIES.csv
//
// Зачем: в выгрузке расходов нужны колонки EÜR-Zeile/EÜR-Kz, а в карточке расхода — подсказка,
// куда попадёт Beleg в Anlage EÜR. Коды справочника CRM и каталога ELSTER разные, поэтому
// ELSTER_CRM_ALIASES переводит код расхода в код CSV, а уже тот даёт строку и Kennzahl.

export interface ElsterMappingEntry {
    /** Строка Anlage EÜR, например "27" или "31-38"; пусто у групп и не-расходных категорий. */
    euerLine: string;
    /** Kennzahl ELSTER, например "100"; у строк с двумя колонками — "165/175". */
    euerKz: string;
    /** Официальное название строки из CSV (подсказка в интерфейсе). */
    euerLabel: string;
    /** Kennzahl Umsatzsteuer-Voranmeldung; "66*" — Vorsteuer только при выполнении условий. */
    ustKz: string;
    /** Корень справочника: своей строки EÜR нет, нужна подкатегория. */
    group: boolean;
    /** Код в исходном CSV — для сверки с ELSTER_MAPPING.md. */
    source: string;
}

/** Путь/имя источника, откуда сгенерированы строки и Kz. */
export const ELSTER_MAPPING_SOURCE = "docs/ELSTER_CATEGORIES.csv";

/** Строки Anlage EÜR по коду каталога ELSTER (112 категорий). */
export const ELSTER_CATEGORY_MAPPING: Record<string, ElsterMappingEntry> = {
    "anlagevermoegen": {
        "euerLine": "",
        "euerKz": "",
        "euerLabel": "Sammelkategorie (keine eigene EÜR-Zeile)",
        "ustKz": "",
        "group": true,
        "source": "anlagevermoegen"
    },
    "material": {
        "euerLine": "",
        "euerKz": "",
        "euerLabel": "Sammelkategorie (keine eigene EÜR-Zeile)",
        "ustKz": "66",
        "group": true,
        "source": "material"
    },
    "werkzeuge": {
        "euerLine": "",
        "euerKz": "",
        "euerLabel": "Sammelkategorie (keine eigene EÜR-Zeile)",
        "ustKz": "66",
        "group": true,
        "source": "werkzeuge"
    },
    "fahrzeug": {
        "euerLine": "",
        "euerKz": "",
        "euerLabel": "Sammelkategorie (keine eigene EÜR-Zeile)",
        "ustKz": "66",
        "group": true,
        "source": "fahrzeug"
    },
    "betriebsausgaben": {
        "euerLine": "",
        "euerKz": "",
        "euerLabel": "Sammelkategorie (keine eigene EÜR-Zeile)",
        "ustKz": "66",
        "group": true,
        "source": "betriebsausgaben"
    },
    "loehne": {
        "euerLine": "",
        "euerKz": "",
        "euerLabel": "Sammelkategorie (keine eigene EÜR-Zeile)",
        "ustKz": "",
        "group": true,
        "source": "loehne"
    },
    "steuern": {
        "euerLine": "",
        "euerKz": "",
        "euerLabel": "Sammelkategorie (keine eigene EÜR-Zeile)",
        "ustKz": "",
        "group": true,
        "source": "steuern"
    },
    "privatentnahme": {
        "euerLine": "",
        "euerKz": "",
        "euerLabel": "Sammelkategorie (keine eigene EÜR-Zeile)",
        "ustKz": "",
        "group": true,
        "source": "privatentnahme"
    },
    "anlagevermoegen.maschinen": {
        "euerLine": "33",
        "euerKz": "130",
        "euerLabel": "AfA auf bewegliche Wirtschaftsgüter (Kz 130)",
        "ustKz": "66",
        "group": false,
        "source": "anlagevermoegen.maschinen"
    },
    "anlagevermoegen.fahrzeuge": {
        "euerLine": "33",
        "euerKz": "130",
        "euerLabel": "AfA auf bewegliche Wirtschaftsgüter (Kz 130)",
        "ustKz": "66",
        "group": false,
        "source": "anlagevermoegen.fahrzeuge"
    },
    "anlagevermoegen.betriebsausstattung": {
        "euerLine": "33",
        "euerKz": "130",
        "euerLabel": "AfA auf bewegliche Wirtschaftsgüter (Kz 130)",
        "ustKz": "66",
        "group": false,
        "source": "anlagevermoegen.betriebsausstattung"
    },
    "anlagevermoegen.bueromoebel": {
        "euerLine": "33",
        "euerKz": "130",
        "euerLabel": "AfA auf bewegliche Wirtschaftsgüter (Kz 130)",
        "ustKz": "66",
        "group": false,
        "source": "anlagevermoegen.bueromoebel"
    },
    "anlagevermoegen.it_hardware": {
        "euerLine": "33",
        "euerKz": "130",
        "euerLabel": "AfA auf bewegliche Wirtschaftsgüter (Kz 130)",
        "ustKz": "66",
        "group": false,
        "source": "anlagevermoegen.it_hardware"
    },
    "anlagevermoegen.software_lizenzen": {
        "euerLine": "32",
        "euerKz": "131",
        "euerLabel": "AfA auf immaterielle Wirtschaftsgüter (Kz 131)",
        "ustKz": "66",
        "group": false,
        "source": "anlagevermoegen.software_lizenzen"
    },
    "anlagevermoegen.gebaeude": {
        "euerLine": "31",
        "euerKz": "136",
        "euerLabel": "AfA auf Grundstücke/grundstücksgleiche Rechte (Kz 136)",
        "ustKz": "66",
        "group": false,
        "source": "anlagevermoegen.gebaeude"
    },
    "anlagevermoegen.gwg": {
        "euerLine": "36",
        "euerKz": "132",
        "euerLabel": "GWG nach § 6 Abs. 2 EStG (Kz 132)",
        "ustKz": "66",
        "group": false,
        "source": "anlagevermoegen.gwg"
    },
    "anlagevermoegen.gwg_sammelposten": {
        "euerLine": "37",
        "euerKz": "137",
        "euerLabel": "Auflösung Sammelposten § 6 Abs. 2a EStG (Kz 137)",
        "ustKz": "66",
        "group": false,
        "source": "anlagevermoegen.gwg_sammelposten"
    },
    "material.waren": {
        "euerLine": "27",
        "euerKz": "100",
        "euerLabel": "Waren, Rohstoffe und Hilfsstoffe einschl. Nebenkosten (Kz 100)",
        "ustKz": "66",
        "group": false,
        "source": "material.waren"
    },
    "material.rohstoffe": {
        "euerLine": "27",
        "euerKz": "100",
        "euerLabel": "Waren, Rohstoffe und Hilfsstoffe einschl. Nebenkosten (Kz 100)",
        "ustKz": "66",
        "group": false,
        "source": "material.rohstoffe"
    },
    "material.hilfsstoffe": {
        "euerLine": "27",
        "euerKz": "100",
        "euerLabel": "Waren, Rohstoffe und Hilfsstoffe einschl. Nebenkosten (Kz 100)",
        "ustKz": "66",
        "group": false,
        "source": "material.hilfsstoffe"
    },
    "material.betriebsstoffe": {
        "euerLine": "27",
        "euerKz": "100",
        "euerLabel": "Waren, Rohstoffe und Hilfsstoffe einschl. Nebenkosten (Kz 100)",
        "ustKz": "66",
        "group": false,
        "source": "material.betriebsstoffe"
    },
    "material.verpackung": {
        "euerLine": "53",
        "euerKz": "227",
        "euerLabel": "Verpackung und Transport (Kz 227)",
        "ustKz": "66",
        "group": false,
        "source": "material.verpackung"
    },
    "material.fremdleistungen": {
        "euerLine": "29",
        "euerKz": "110",
        "euerLabel": "Bezogene Fremdleistungen (Kz 110)",
        "ustKz": "66",
        "group": false,
        "source": "material.fremdleistungen"
    },
    "werkzeuge.handwerkzeug": {
        "euerLine": "51",
        "euerKz": "229",
        "euerLabel": "Arbeitsmittel: Bürobedarf, Porto, Fachliteratur (Kz 229)",
        "ustKz": "66",
        "group": false,
        "source": "werkzeuge.handwerkzeug"
    },
    "werkzeuge.elektrowerkzeuge": {
        "euerLine": "51",
        "euerKz": "229",
        "euerLabel": "Arbeitsmittel: Bürobedarf, Porto, Fachliteratur (Kz 229)",
        "ustKz": "66",
        "group": false,
        "source": "werkzeuge.elektrowerkzeuge"
    },
    "werkzeuge.maschinen_werkzeuge": {
        "euerLine": "51",
        "euerKz": "229",
        "euerLabel": "Arbeitsmittel: Bürobedarf, Porto, Fachliteratur (Kz 229)",
        "ustKz": "66",
        "group": false,
        "source": "werkzeuge.maschinen_werkzeuge"
    },
    "werkzeuge.messgeraete": {
        "euerLine": "51",
        "euerKz": "229",
        "euerLabel": "Arbeitsmittel: Bürobedarf, Porto, Fachliteratur (Kz 229)",
        "ustKz": "66",
        "group": false,
        "source": "werkzeuge.messgeraete"
    },
    "werkzeuge.verbrauchsmaterial_werkzeug": {
        "euerLine": "51",
        "euerKz": "229",
        "euerLabel": "Arbeitsmittel: Bürobedarf, Porto, Fachliteratur (Kz 229)",
        "ustKz": "66",
        "group": false,
        "source": "werkzeuge.verbrauchsmaterial_werkzeug"
    },
    "werkzeuge.werkzeug_reparatur": {
        "euerLine": "48",
        "euerKz": "225",
        "euerLabel": "Erhaltungsaufwendungen ohne Gebäude/Kfz (Kz 225)",
        "ustKz": "66",
        "group": false,
        "source": "werkzeuge.werkzeug_reparatur"
    },
    "werkzeuge.werkzeug_leasing": {
        "euerLine": "47",
        "euerKz": "222",
        "euerLabel": "Miete/Leasing für bewegliche WG ohne Kfz (Kz 222)",
        "ustKz": "66",
        "group": false,
        "source": "werkzeuge.werkzeug_leasing"
    },
    "fahrzeug.kraftstoff": {
        "euerLine": "70",
        "euerKz": "146",
        "euerLabel": "Sonstige tatsächliche Fahrtkosten (Kz 146)",
        "ustKz": "66",
        "group": false,
        "source": "fahrzeug.kraftstoff"
    },
    "fahrzeug.strom_laden": {
        "euerLine": "70",
        "euerKz": "146",
        "euerLabel": "Sonstige tatsächliche Fahrtkosten (Kz 146)",
        "ustKz": "66",
        "group": false,
        "source": "fahrzeug.strom_laden"
    },
    "fahrzeug.reparatur": {
        "euerLine": "70",
        "euerKz": "146",
        "euerLabel": "Sonstige tatsächliche Fahrtkosten (Kz 146)",
        "ustKz": "66",
        "group": false,
        "source": "fahrzeug.reparatur"
    },
    "fahrzeug.wartung": {
        "euerLine": "70",
        "euerKz": "146",
        "euerLabel": "Sonstige tatsächliche Fahrtkosten (Kz 146)",
        "ustKz": "66",
        "group": false,
        "source": "fahrzeug.wartung"
    },
    "fahrzeug.versicherung": {
        "euerLine": "69",
        "euerKz": "145",
        "euerLabel": "Kfz-Steuern, -Versicherungen und Maut (Kz 145)",
        "ustKz": "",
        "group": false,
        "source": "fahrzeug.versicherung"
    },
    "fahrzeug.kfz_steuer": {
        "euerLine": "69",
        "euerKz": "145",
        "euerLabel": "Kfz-Steuern, -Versicherungen und Maut (Kz 145)",
        "ustKz": "",
        "group": false,
        "source": "fahrzeug.kfz_steuer"
    },
    "fahrzeug.leasing": {
        "euerLine": "68",
        "euerKz": "144",
        "euerLabel": "Kfz-Leasingkosten (Kz 144)",
        "ustKz": "66",
        "group": false,
        "source": "fahrzeug.leasing"
    },
    "fahrzeug.miete": {
        "euerLine": "70",
        "euerKz": "146",
        "euerLabel": "Sonstige tatsächliche Fahrtkosten (Kz 146)",
        "ustKz": "66",
        "group": false,
        "source": "fahrzeug.miete"
    },
    "fahrzeug.reifen": {
        "euerLine": "70",
        "euerKz": "146",
        "euerLabel": "Sonstige tatsächliche Fahrtkosten (Kz 146)",
        "ustKz": "66",
        "group": false,
        "source": "fahrzeug.reifen"
    },
    "fahrzeug.pflege": {
        "euerLine": "70",
        "euerKz": "146",
        "euerLabel": "Sonstige tatsächliche Fahrtkosten (Kz 146)",
        "ustKz": "66",
        "group": false,
        "source": "fahrzeug.pflege"
    },
    "fahrzeug.parken": {
        "euerLine": "70",
        "euerKz": "146",
        "euerLabel": "Sonstige tatsächliche Fahrtkosten (Kz 146)",
        "ustKz": "66",
        "group": false,
        "source": "fahrzeug.parken"
    },
    "fahrzeug.maut": {
        "euerLine": "69",
        "euerKz": "145",
        "euerLabel": "Kfz-Steuern, -Versicherungen und Maut (Kz 145)",
        "ustKz": "66*",
        "group": false,
        "source": "fahrzeug.maut"
    },
    "fahrzeug.sonstiges": {
        "euerLine": "70",
        "euerKz": "146",
        "euerLabel": "Sonstige tatsächliche Fahrtkosten (Kz 146)",
        "ustKz": "66",
        "group": false,
        "source": "fahrzeug.sonstiges"
    },
    "fahrzeug.privatnutzung": {
        "euerLine": "20",
        "euerKz": "106",
        "euerLabel": "Private Kfz-Nutzung (Betriebseinnahme, Kz 106)",
        "ustKz": "",
        "group": false,
        "source": "fahrzeug.privatnutzung"
    },
    "betriebsausgaben.miete": {
        "euerLine": "39",
        "euerKz": "150",
        "euerLabel": "Miete/Pacht für Geschäftsräume und Grundstücke (Kz 150)",
        "ustKz": "66*",
        "group": false,
        "source": "betriebsausgaben.miete"
    },
    "betriebsausgaben.pacht": {
        "euerLine": "39",
        "euerKz": "150",
        "euerLabel": "Miete/Pacht für Geschäftsräume und Grundstücke (Kz 150)",
        "ustKz": "66*",
        "group": false,
        "source": "betriebsausgaben.pacht"
    },
    "betriebsausgaben.nebenkosten_raum": {
        "euerLine": "41",
        "euerKz": "151",
        "euerLabel": "Sonstige Aufwendungen für betrieblich genutzte Grundstücke (Kz 151)",
        "ustKz": "66",
        "group": false,
        "source": "betriebsausgaben.nebenkosten_raum"
    },
    "betriebsausgaben.heizung": {
        "euerLine": "41",
        "euerKz": "151",
        "euerLabel": "Sonstige Aufwendungen für betrieblich genutzte Grundstücke (Kz 151)",
        "ustKz": "66",
        "group": false,
        "source": "betriebsausgaben.heizung"
    },
    "betriebsausgaben.strom": {
        "euerLine": "41",
        "euerKz": "151",
        "euerLabel": "Sonstige Aufwendungen für betrieblich genutzte Grundstücke (Kz 151)",
        "ustKz": "66",
        "group": false,
        "source": "betriebsausgaben.strom"
    },
    "betriebsausgaben.gas": {
        "euerLine": "41",
        "euerKz": "151",
        "euerLabel": "Sonstige Aufwendungen für betrieblich genutzte Grundstücke (Kz 151)",
        "ustKz": "66",
        "group": false,
        "source": "betriebsausgaben.gas"
    },
    "betriebsausgaben.wasser": {
        "euerLine": "41",
        "euerKz": "151",
        "euerLabel": "Sonstige Aufwendungen für betrieblich genutzte Grundstücke (Kz 151)",
        "ustKz": "66",
        "group": false,
        "source": "betriebsausgaben.wasser"
    },
    "betriebsausgaben.versicherungen": {
        "euerLine": "49",
        "euerKz": "223",
        "euerLabel": "Beiträge, Gebühren, Abgaben und Versicherungen (Kz 223)",
        "ustKz": "",
        "group": false,
        "source": "betriebsausgaben.versicherungen"
    },
    "betriebsausgaben.versicherung_gebaeude": {
        "euerLine": "41",
        "euerKz": "151",
        "euerLabel": "Sonstige Aufwendungen für betrieblich genutzte Grundstücke (Kz 151)",
        "ustKz": "",
        "group": false,
        "source": "betriebsausgaben.versicherung_gebaeude"
    },
    "betriebsausgaben.buero": {
        "euerLine": "51",
        "euerKz": "229",
        "euerLabel": "Arbeitsmittel: Bürobedarf, Porto, Fachliteratur (Kz 229)",
        "ustKz": "66",
        "group": false,
        "source": "betriebsausgaben.buero"
    },
    "betriebsausgaben.telefon": {
        "euerLine": "43",
        "euerKz": "280",
        "euerLabel": "Aufwendungen für Telekommunikation (Kz 280)",
        "ustKz": "66",
        "group": false,
        "source": "betriebsausgaben.telefon"
    },
    "betriebsausgaben.internet": {
        "euerLine": "43",
        "euerKz": "280",
        "euerLabel": "Aufwendungen für Telekommunikation (Kz 280)",
        "ustKz": "66",
        "group": false,
        "source": "betriebsausgaben.internet"
    },
    "betriebsausgaben.porto": {
        "euerLine": "51",
        "euerKz": "229",
        "euerLabel": "Arbeitsmittel: Bürobedarf, Porto, Fachliteratur (Kz 229)",
        "ustKz": "66",
        "group": false,
        "source": "betriebsausgaben.porto"
    },
    "betriebsausgaben.reisekosten": {
        "euerLine": "44",
        "euerKz": "221",
        "euerLabel": "Übernachtungs- und Reisenebenkosten (Kz 221)",
        "ustKz": "66",
        "group": false,
        "source": "betriebsausgaben.reisekosten"
    },
    "betriebsausgaben.uebernachtung": {
        "euerLine": "44",
        "euerKz": "221",
        "euerLabel": "Übernachtungs- und Reisenebenkosten (Kz 221)",
        "ustKz": "66",
        "group": false,
        "source": "betriebsausgaben.uebernachtung"
    },
    "betriebsausgaben.verpflegung": {
        "euerLine": "64",
        "euerKz": "171",
        "euerLabel": "Verpflegungsmehraufwendungen (Kz 171)",
        "ustKz": "",
        "group": false,
        "source": "betriebsausgaben.verpflegung"
    },
    "betriebsausgaben.fahrtkosten": {
        "euerLine": "70",
        "euerKz": "146",
        "euerLabel": "Sonstige tatsächliche Fahrtkosten (Kz 146)",
        "ustKz": "66",
        "group": false,
        "source": "betriebsausgaben.fahrtkosten"
    },
    "betriebsausgaben.flug": {
        "euerLine": "70",
        "euerKz": "146",
        "euerLabel": "Sonstige tatsächliche Fahrtkosten (Kz 146)",
        "ustKz": "66",
        "group": false,
        "source": "betriebsausgaben.flug"
    },
    "betriebsausgaben.fortbildung": {
        "euerLine": "45",
        "euerKz": "281",
        "euerLabel": "Fortbildungskosten (Kz 281)",
        "ustKz": "66",
        "group": false,
        "source": "betriebsausgaben.fortbildung"
    },
    "betriebsausgaben.marketing": {
        "euerLine": "54",
        "euerKz": "224",
        "euerLabel": "Werbekosten (Kz 224)",
        "ustKz": "66",
        "group": false,
        "source": "betriebsausgaben.marketing"
    },
    "betriebsausgaben.beratung": {
        "euerLine": "60",
        "euerKz": "183",
        "euerLabel": "Übrige unbeschränkt abziehbare Betriebsausgaben (Kz 183)",
        "ustKz": "66",
        "group": false,
        "source": "betriebsausgaben.beratung"
    },
    "betriebsausgaben.steuerberatung": {
        "euerLine": "46",
        "euerKz": "194",
        "euerLabel": "Rechts- und Steuerberatung, Buchführung (Kz 194)",
        "ustKz": "66",
        "group": false,
        "source": "betriebsausgaben.steuerberatung"
    },
    "betriebsausgaben.rechtsberatung": {
        "euerLine": "46",
        "euerKz": "194",
        "euerLabel": "Rechts- und Steuerberatung, Buchführung (Kz 194)",
        "ustKz": "66",
        "group": false,
        "source": "betriebsausgaben.rechtsberatung"
    },
    "betriebsausgaben.software_it": {
        "euerLine": "50",
        "euerKz": "228",
        "euerLabel": "Laufende EDV-Kosten (Kz 228)",
        "ustKz": "67",
        "group": false,
        "source": "betriebsausgaben.software_it"
    },
    "betriebsausgaben.hosting_cloud": {
        "euerLine": "50",
        "euerKz": "228",
        "euerLabel": "Laufende EDV-Kosten (Kz 228)",
        "ustKz": "67",
        "group": false,
        "source": "betriebsausgaben.hosting_cloud"
    },
    "betriebsausgaben.wartung_software": {
        "euerLine": "50",
        "euerKz": "228",
        "euerLabel": "Laufende EDV-Kosten (Kz 228)",
        "ustKz": "66",
        "group": false,
        "source": "betriebsausgaben.wartung_software"
    },
    "betriebsausgaben.beitraege": {
        "euerLine": "49",
        "euerKz": "223",
        "euerLabel": "Beiträge, Gebühren, Abgaben und Versicherungen (Kz 223)",
        "ustKz": "",
        "group": false,
        "source": "betriebsausgaben.beitraege"
    },
    "betriebsausgaben.gebuehren": {
        "euerLine": "49",
        "euerKz": "223",
        "euerLabel": "Beiträge, Gebühren, Abgaben und Versicherungen (Kz 223)",
        "ustKz": "66*",
        "group": false,
        "source": "betriebsausgaben.gebuehren"
    },
    "betriebsausgaben.bankgebuehren": {
        "euerLine": "60",
        "euerKz": "183",
        "euerLabel": "Übrige unbeschränkt abziehbare Betriebsausgaben (Kz 183)",
        "ustKz": "",
        "group": false,
        "source": "betriebsausgaben.bankgebuehren"
    },
    "betriebsausgaben.nebenkosten_geldverkehr": {
        "euerLine": "60",
        "euerKz": "183",
        "euerLabel": "Übrige unbeschränkt abziehbare Betriebsausgaben (Kz 183)",
        "ustKz": "",
        "group": false,
        "source": "betriebsausgaben.nebenkosten_geldverkehr"
    },
    "betriebsausgaben.abschreibungen": {
        "euerLine": "31-38",
        "euerKz": "136/131/130/134/138/132/137/135",
        "euerLabel": "AfA-Sammelzeilen 31–38 (Kz 136/131/130/134/138/132/137/135)",
        "ustKz": "66",
        "group": false,
        "source": "betriebsausgaben.abschreibungen"
    },
    "betriebsausgaben.bewirtung": {
        "euerLine": "63",
        "euerKz": "165/175",
        "euerLabel": "Bewirtungsaufwendungen (Kz 165 / 175)",
        "ustKz": "66",
        "group": false,
        "source": "betriebsausgaben.bewirtung"
    },
    "betriebsausgaben.geschenke": {
        "euerLine": "62",
        "euerKz": "164/174",
        "euerLabel": "Geschenke (Kz 164 nicht abziehbar / 174 abziehbar)",
        "ustKz": "66*",
        "group": false,
        "source": "betriebsausgaben.geschenke"
    },
    "betriebsausgaben.arbeitskleidung": {
        "euerLine": "51",
        "euerKz": "229",
        "euerLabel": "Arbeitsmittel: Bürobedarf, Porto, Fachliteratur (Kz 229)",
        "ustKz": "66",
        "group": false,
        "source": "betriebsausgaben.arbeitskleidung"
    },
    "betriebsausgaben.arbeitssicherheit": {
        "euerLine": "51",
        "euerKz": "229",
        "euerLabel": "Arbeitsmittel: Bürobedarf, Porto, Fachliteratur (Kz 229)",
        "ustKz": "66",
        "group": false,
        "source": "betriebsausgaben.arbeitssicherheit"
    },
    "betriebsausgaben.entsorgung": {
        "euerLine": "52",
        "euerKz": "226",
        "euerLabel": "Abfallbeseitigung und Entsorgung (Kz 226)",
        "ustKz": "66",
        "group": false,
        "source": "betriebsausgaben.entsorgung"
    },
    "betriebsausgaben.reinigung": {
        "euerLine": "41",
        "euerKz": "151",
        "euerLabel": "Sonstige Aufwendungen für betrieblich genutzte Grundstücke (Kz 151)",
        "ustKz": "66",
        "group": false,
        "source": "betriebsausgaben.reinigung"
    },
    "betriebsausgaben.reparatur_instandhaltung": {
        "euerLine": "48",
        "euerKz": "225",
        "euerLabel": "Erhaltungsaufwendungen ohne Gebäude/Kfz (Kz 225)",
        "ustKz": "66",
        "group": false,
        "source": "betriebsausgaben.reparatur_instandhaltung"
    },
    "betriebsausgaben.instandhaltung_gebaeude": {
        "euerLine": "41",
        "euerKz": "151",
        "euerLabel": "Sonstige Aufwendungen für betrieblich genutzte Grundstücke (Kz 151)",
        "ustKz": "66",
        "group": false,
        "source": "betriebsausgaben.instandhaltung_gebaeude"
    },
    "betriebsausgaben.instandhaltung_maschinen": {
        "euerLine": "48",
        "euerKz": "225",
        "euerLabel": "Erhaltungsaufwendungen ohne Gebäude/Kfz (Kz 225)",
        "ustKz": "66",
        "group": false,
        "source": "betriebsausgaben.instandhaltung_maschinen"
    },
    "betriebsausgaben.instandhaltung_ausstattung": {
        "euerLine": "48",
        "euerKz": "225",
        "euerLabel": "Erhaltungsaufwendungen ohne Gebäude/Kfz (Kz 225)",
        "ustKz": "66",
        "group": false,
        "source": "betriebsausgaben.instandhaltung_ausstattung"
    },
    "betriebsausgaben.miete_bewegliche": {
        "euerLine": "47",
        "euerKz": "222",
        "euerLabel": "Miete/Leasing für bewegliche WG ohne Kfz (Kz 222)",
        "ustKz": "66",
        "group": false,
        "source": "betriebsausgaben.miete_bewegliche"
    },
    "betriebsausgaben.leasing_bewegliche": {
        "euerLine": "47",
        "euerKz": "222",
        "euerLabel": "Miete/Leasing für bewegliche WG ohne Kfz (Kz 222)",
        "ustKz": "66",
        "group": false,
        "source": "betriebsausgaben.leasing_bewegliche"
    },
    "betriebsausgaben.literatur": {
        "euerLine": "51",
        "euerKz": "229",
        "euerLabel": "Arbeitsmittel: Bürobedarf, Porto, Fachliteratur (Kz 229)",
        "ustKz": "66",
        "group": false,
        "source": "betriebsausgaben.literatur"
    },
    "loehne.gehaelter": {
        "euerLine": "30",
        "euerKz": "120",
        "euerLabel": "Ausgaben für eigenes Personal (Kz 120)",
        "ustKz": "",
        "group": false,
        "source": "loehne.gehaelter"
    },
    "loehne.loehne": {
        "euerLine": "30",
        "euerKz": "120",
        "euerLabel": "Ausgaben für eigenes Personal (Kz 120)",
        "ustKz": "",
        "group": false,
        "source": "loehne.loehne"
    },
    "loehne.aushilfen": {
        "euerLine": "30",
        "euerKz": "120",
        "euerLabel": "Ausgaben für eigenes Personal (Kz 120)",
        "ustKz": "",
        "group": false,
        "source": "loehne.aushilfen"
    },
    "loehne.minijob": {
        "euerLine": "30",
        "euerKz": "120",
        "euerLabel": "Ausgaben für eigenes Personal (Kz 120)",
        "ustKz": "",
        "group": false,
        "source": "loehne.minijob"
    },
    "loehne.auszubildende": {
        "euerLine": "30",
        "euerKz": "120",
        "euerLabel": "Ausgaben für eigenes Personal (Kz 120)",
        "ustKz": "",
        "group": false,
        "source": "loehne.auszubildende"
    },
    "loehne.geschaeftsfuehrer": {
        "euerLine": "30",
        "euerKz": "120",
        "euerLabel": "Ausgaben für eigenes Personal (Kz 120)",
        "ustKz": "",
        "group": false,
        "source": "loehne.geschaeftsfuehrer"
    },
    "loehne.sozialversicherung": {
        "euerLine": "30",
        "euerKz": "120",
        "euerLabel": "Ausgaben für eigenes Personal (Kz 120)",
        "ustKz": "",
        "group": false,
        "source": "loehne.sozialversicherung"
    },
    "loehne.berufsgenossenschaft": {
        "euerLine": "30",
        "euerKz": "120",
        "euerLabel": "Ausgaben für eigenes Personal (Kz 120)",
        "ustKz": "",
        "group": false,
        "source": "loehne.berufsgenossenschaft"
    },
    "loehne.minijob_abgaben": {
        "euerLine": "30",
        "euerKz": "120",
        "euerLabel": "Ausgaben für eigenes Personal (Kz 120)",
        "ustKz": "",
        "group": false,
        "source": "loehne.minijob_abgaben"
    },
    "loehne.vermoegenswirksame_leistungen": {
        "euerLine": "30",
        "euerKz": "120",
        "euerLabel": "Ausgaben für eigenes Personal (Kz 120)",
        "ustKz": "",
        "group": false,
        "source": "loehne.vermoegenswirksame_leistungen"
    },
    "loehne.freiwillige_sozialleistungen": {
        "euerLine": "30",
        "euerKz": "120",
        "euerLabel": "Ausgaben für eigenes Personal (Kz 120)",
        "ustKz": "",
        "group": false,
        "source": "loehne.freiwillige_sozialleistungen"
    },
    "steuern.umsatzsteuer": {
        "euerLine": "58",
        "euerKz": "186",
        "euerLabel": "An das Finanzamt gezahlte Umsatzsteuer (Kz 186)",
        "ustKz": "",
        "group": false,
        "source": "steuern.umsatzsteuer"
    },
    "steuern.gewerbesteuer": {
        "euerLine": "67",
        "euerKz": "168/177",
        "euerLabel": "Sonstige beschränkt abziehbare Betriebsausgaben (Kz 168 / 177)",
        "ustKz": "",
        "group": false,
        "source": "steuern.gewerbesteuer"
    },
    "steuern.grundsteuer": {
        "euerLine": "41",
        "euerKz": "151",
        "euerLabel": "Sonstige Aufwendungen für betrieblich genutzte Grundstücke (Kz 151)",
        "ustKz": "",
        "group": false,
        "source": "steuern.grundsteuer"
    },
    "steuern.sonstige_betriebssteuern": {
        "euerLine": "67",
        "euerKz": "168/177",
        "euerLabel": "Sonstige beschränkt abziehbare Betriebsausgaben (Kz 168 / 177)",
        "ustKz": "",
        "group": false,
        "source": "steuern.sonstige_betriebssteuern"
    },
    "steuern.saeumniszuschlag": {
        "euerLine": "60",
        "euerKz": "183",
        "euerLabel": "Übrige unbeschränkt abziehbare Betriebsausgaben (Kz 183)",
        "ustKz": "",
        "group": false,
        "source": "steuern.saeumniszuschlag"
    },
    "privatentnahme.geld": {
        "euerLine": "106",
        "euerKz": "122",
        "euerLabel": "Entnahmen Zeile 106",
        "ustKz": "",
        "group": false,
        "source": "privatentnahme.geld"
    },
    "privatentnahme.waren": {
        "euerLine": "106",
        "euerKz": "122",
        "euerLabel": "Entnahmen Zeile 106",
        "ustKz": "",
        "group": false,
        "source": "privatentnahme.waren"
    },
    "privatentnahme.ausgaben": {
        "euerLine": "",
        "euerKz": "",
        "euerLabel": "keine EÜR-Zeile (nicht betrieblich)",
        "ustKz": "",
        "group": false,
        "source": "privatentnahme.ausgaben"
    },
    "privatentnahme.versicherung": {
        "euerLine": "",
        "euerKz": "",
        "euerLabel": "keine EÜR-Zeile (nicht betrieblich)",
        "ustKz": "",
        "group": false,
        "source": "privatentnahme.versicherung"
    },
    "privatentnahme.kfz": {
        "euerLine": "",
        "euerKz": "",
        "euerLabel": "keine EÜR-Zeile (nicht betrieblich)",
        "ustKz": "",
        "group": false,
        "source": "privatentnahme.kfz"
    },
    "privatentnahme.reisen": {
        "euerLine": "",
        "euerKz": "",
        "euerLabel": "keine EÜR-Zeile (nicht betrieblich)",
        "ustKz": "",
        "group": false,
        "source": "privatentnahme.reisen"
    },
    "privatentnahme.steuern": {
        "euerLine": "",
        "euerKz": "",
        "euerLabel": "keine EÜR-Zeile (nicht betrieblich)",
        "ustKz": "",
        "group": false,
        "source": "privatentnahme.steuern"
    },
    "privatentnahme.lebenshaltung": {
        "euerLine": "",
        "euerKz": "",
        "euerLabel": "keine EÜR-Zeile (nicht betrieblich)",
        "ustKz": "",
        "group": false,
        "source": "privatentnahme.lebenshaltung"
    }
};

/**
 * Коды справочника CRM → коды каталога ELSTER (88 соответствий).
 * 7 кодов CRM намеренно без соответствия: в CSV нет подходящей категории, выгрузка
 * покажет пустые EÜR-Zeile/Kz и предупреждение. Список: arbeitszimmer, trinkgeld, personalbeschaffung, koerperschaftsteuer, spenden, verluste, zinsen.
 */
export const ELSTER_CRM_ALIASES: Record<string, string> = {
    "wareneinkauf": "material",
    "wareneinkauf_19": "material.waren",
    "wareneinkauf_7": "material.waren",
    "wareneinkauf_ohne_ust": "material.waren",
    "rohstoffe": "material.rohstoffe",
    "handelswaren": "material.waren",
    "fremdleistungen": "material.fremdleistungen",
    "verpackung": "material.verpackung",
    "betriebsbedarf": "werkzeuge.verbrauchsmaterial_werkzeug",
    "buerobedarf": "betriebsausgaben.buero",
    "buero": "betriebsausgaben",
    "zeitschriften_buecher": "betriebsausgaben.literatur",
    "porto": "betriebsausgaben.porto",
    "buchfuehrung": "betriebsausgaben.steuerberatung",
    "steuerberatung": "betriebsausgaben.steuerberatung",
    "rechtsberatung": "betriebsausgaben.rechtsberatung",
    "bankgebuehren": "betriebsausgaben.bankgebuehren",
    "fortschbildung": "betriebsausgaben.fortbildung",
    "beitraege": "betriebsausgaben.beitraege",
    "software_abos": "betriebsausgaben.software_it",
    "sonstige_verwaltung": "betriebsausgaben.beratung",
    "miete": "betriebsausgaben.miete",
    "raum": "betriebsausgaben",
    "nebenkosten_raum": "betriebsausgaben.nebenkosten_raum",
    "strom": "betriebsausgaben.strom",
    "gas": "betriebsausgaben.gas",
    "wasser": "betriebsausgaben.wasser",
    "heizung": "betriebsausgaben.heizung",
    "reinigung": "betriebsausgaben.reinigung",
    "instandhaltung_gebaeude": "betriebsausgaben.instandhaltung_gebaeude",
    "grundsteuer": "steuern.grundsteuer",
    "sonstige_raumkosten": "betriebsausgaben.nebenkosten_raum",
    "fahrzeug": "fahrzeug",
    "kfz_leasing": "fahrzeug.leasing",
    "kfz_versicherung": "fahrzeug.versicherung",
    "kfz_betriebskosten": "fahrzeug.kraftstoff",
    "kfz_reparatur": "fahrzeug.reparatur",
    "kfz_maut": "fahrzeug.maut",
    "kfz_sonstiges": "fahrzeug.sonstiges",
    "kfz_steuer": "fahrzeug.kfz_steuer",
    "reisekosten": "betriebsausgaben.reisekosten",
    "uebernachtung": "betriebsausgaben.uebernachtung",
    "reise": "betriebsausgaben",
    "verpflegung": "betriebsausgaben.verpflegung",
    "bewirtung": "betriebsausgaben.bewirtung",
    "geschenke": "betriebsausgaben.geschenke",
    "werbung_online": "betriebsausgaben.marketing",
    "werbung_print": "betriebsausgaben.marketing",
    "messen": "betriebsausgaben.marketing",
    "website": "betriebsausgaben.marketing",
    "sponsoring": "betriebsausgaben.marketing",
    "verkaufsprovision": "betriebsausgaben.beratung",
    "marketing": "betriebsausgaben",
    "vertriebskosten": "betriebsausgaben.beratung",
    "versicherungen": "betriebsausgaben.versicherungen",
    "betriebshaftpflicht": "betriebsausgaben.versicherungen",
    "rechtsschutz": "betriebsausgaben.versicherungen",
    "unfallversicherung": "betriebsausgaben.versicherungen",
    "lebensversicherung": "betriebsausgaben.versicherungen",
    "berufsverband": "betriebsausgaben.beitraege",
    "loehne": "loehne.loehne",
    "gehaelter": "loehne.gehaelter",
    "sozialabgaben": "loehne.sozialversicherung",
    "arbeitskleidung": "betriebsausgaben.arbeitskleidung",
    "versicherung": "betriebsausgaben",
    "fortbildung_personal": "betriebsausgaben.fortbildung",
    "telefon_internet": "betriebsausgaben.telefon",
    "internet": "betriebsausgaben.internet",
    "hosting_domain": "betriebsausgaben.hosting_cloud",
    "hardware": "anlagevermoegen.it_hardware",
    "software_lizenz": "anlagevermoegen.software_lizenzen",
    "gwg": "anlagevermoegen.gwg",
    "it_zubehoer": "betriebsausgaben.buero",
    "bueromoebel": "anlagevermoegen.bueromoebel",
    "personal": "loehne",
    "maschinen": "anlagevermoegen.maschinen",
    "fahrzeug_kauf": "anlagevermoegen.fahrzeuge",
    "immobilie": "anlagevermoegen.gebaeude",
    "gewerbesteuer": "steuern.gewerbesteuer",
    "sonstige_steuern": "steuern.sonstige_betriebssteuern",
    "privatentnahme": "privatentnahme.geld",
    "privatausgabe": "privatentnahme.ausgaben",
    "sonstiges_allgemein": "betriebsausgaben.beratung",
    "it": "betriebsausgaben",
    "anlagen": "anlagevermoegen",
    "steuern": "steuern",
    "privat": "privatentnahme",
    "sonstiges": "betriebsausgaben"
};

/**
 * Строка EÜR и Kz для кода расхода: сначала переходник CRM → ELSTER, затем прямое совпадение
 * с каталогом ELSTER. Alias важнее: у CRM есть лист «privatentnahme» (Geldentnahme), а в CSV
 * этим же словом названа группа; расход хранит код CRM, и ему нужна строка 106, а не «GRUPPE».
 * `null` — код неизвестен (в выгрузке это предупреждение).
 */
export function elsterMappingFor(code: string): ElsterMappingEntry | null {
    const key = String(code ?? "").trim();
    if (!key) return null;
    const alias = ELSTER_CRM_ALIASES[key];
    if (alias) return ELSTER_CATEGORY_MAPPING[alias] ?? null;
    return ELSTER_CATEGORY_MAPPING[key] ?? null;
}

/** Строка EÜR и Kz, которые имеет смысл печатать: группы и «n/a» дают пустые значения. */
export function elsterLineAndKz(code: string): { line: string; kz: string } {
    const entry = elsterMappingFor(code);
    return entry ? { line: entry.euerLine, kz: entry.euerKz } : { line: "", kz: "" };
}
