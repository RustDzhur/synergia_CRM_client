#!/usr/bin/env node
// Генерация lib/finance/elsterMapping.ts из официального CSV-каталога ELSTER (Bürokratie-Copilot).
//
// Зачем генератор, а не ручная таблица: строки/Kz Anlage EÜR меняются от года к году
// (в 2024/2025 нумерация сдвинулась относительно 2023), и единственный источник правды —
// docs/ELSTER_CATEGORIES.csv. Скрипт читает CSV, вытаскивает Kz из названия строки и пишет
// типизированный маппинг, который импортируют экспорт расходов и карточка расхода.
//
// Два справочника кодов:
//   * ELSTER_CATEGORY_MAPPING — ключ = code из CSV (например betriebsausgaben.buero);
//   * ELSTER_CRM_ALIASES — коды справочника CRM (lib/finance/expenseCategoryCatalog.json,
//     например buerobedarf) → коды CSV. Коды исторически разные, поэтому в выгрузке сначала
//     переводим код расхода через alias, потом ищем строку EÜR.
//
// Запуск:
//   node scripts/generate-elster-mapping.mjs
//   node scripts/generate-elster-mapping.mjs --csv ../burokratie-copilot/docs/ELSTER_CATEGORIES.csv
//   node scripts/generate-elster-mapping.mjs --out /tmp/elsterMapping.ts
//
// Скрипт ничего не меняет, кроме выходного файла; после генерации запустите npx tsc --noEmit.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const arg = (name, fallback) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const csvPath = path.resolve(ROOT, arg("csv", "../burokratie-copilot/docs/ELSTER_CATEGORIES.csv"));
const outPath = path.resolve(ROOT, arg("out", "lib/finance/elsterMapping.ts"));
const catalogPath = path.resolve(ROOT, arg("catalog", "lib/finance/expenseCategoryCatalog.json"));

// ── Минимальный CSV-разбор (разделитель «;», кавычки с удвоением) ───────────────────────────────
function parseCsv(text) {
    const src = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;
    for (let i = 0; i < src.length; i++) {
        const ch = src[i];
        if (quoted) {
            if (ch === '"') {
                if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false;
            } else field += ch;
            continue;
        }
        if (ch === '"') { quoted = true; continue; }
        if (ch === ";") { row.push(field); field = ""; continue; }
        if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; continue; }
        field += ch;
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ""));
    const head = nonEmpty.shift().map((c) => c.trim());
    return nonEmpty.map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()])));
}

// ── Строка EÜR и Kennzahl из CSV ────────────────────────────────────────────────────────────────
// Особые случаи CSV: euer_line = GRUPPE (корень справочника), n/a (privat), n/a (Entnahme 106),
// 31-38 (несколько строк AfA). Kz обычно стоит в euer_label в скобках: «(Kz 130)»,
// «(Kz 165 / 175)» или «(Kz 136/131/…/135)».
const LINE_KZ_OVERRIDE = { "106": "122" }; // Entnahmen: Kz 122 (в названии строки CSV Kz не указана)

function parseLine(raw) {
    const v = String(raw ?? "").trim();
    if (v === "GRUPPE") return { line: "", group: true };
    if (/^n\/a/i.test(v)) {
        const m = v.match(/Entnahme\s+(\d+)/i);
        return { line: m ? m[1] : "", group: false };
    }
    return { line: v, group: false };
}

function parseKz(label, line) {
    const text = String(label ?? "");
    const at = text.indexOf("Kz");
    if (at >= 0) {
        const tail = text.slice(at + 2).split(")")[0];
        const numbers = tail.match(/\d{2,3}/g) ?? [];
        const unique = [...new Set(numbers)];
        if (unique.length) return unique.join("/");
    }
    return LINE_KZ_OVERRIDE[line] ?? "";
}

// ── Переходник «код CRM → код ELSTER CSV» ───────────────────────────────────────────────────────
// Полный список кодов CRM-справочника (lib/finance/expenseCategoryCatalog.json) → строка CSV.
// Прочерк (null) — в CSV нет подходящей категории: расход получит пустые EÜR-Zeile/Kz и
// предупреждение в summary выгрузки (так и задумано, см. п. 6.2 ELSTER_MAPPING.md).
const CRM_TO_ELSTER = {
    // Группы
    wareneinkauf: "material",
    buero: "betriebsausgaben",
    raum: "betriebsausgaben",
    fahrzeug: "fahrzeug",
    reise: "betriebsausgaben",
    marketing: "betriebsausgaben",
    versicherung: "betriebsausgaben",
    personal: "loehne",
    it: "betriebsausgaben",
    anlagen: "anlagevermoegen",
    steuern: "steuern",
    privat: "privatentnahme",
    sonstiges: "betriebsausgaben",
    // Wareneinkauf
    wareneinkauf_19: "material.waren",
    wareneinkauf_7: "material.waren",
    wareneinkauf_ohne_ust: "material.waren",
    rohstoffe: "material.rohstoffe",
    handelswaren: "material.waren",
    fremdleistungen: "material.fremdleistungen",
    verpackung: "material.verpackung",
    betriebsbedarf: "werkzeuge.verbrauchsmaterial_werkzeug",
    // Büro & Verwaltung
    buerobedarf: "betriebsausgaben.buero",
    zeitschriften_buecher: "betriebsausgaben.literatur",
    porto: "betriebsausgaben.porto",
    buchfuehrung: "betriebsausgaben.steuerberatung",
    steuerberatung: "betriebsausgaben.steuerberatung",
    rechtsberatung: "betriebsausgaben.rechtsberatung",
    bankgebuehren: "betriebsausgaben.bankgebuehren",
    fortschbildung: "betriebsausgaben.fortbildung",
    beitraege: "betriebsausgaben.beitraege",
    software_abos: "betriebsausgaben.software_it",
    sonstige_verwaltung: "betriebsausgaben.beratung",
    // Raumkosten
    miete: "betriebsausgaben.miete",
    nebenkosten_raum: "betriebsausgaben.nebenkosten_raum",
    strom: "betriebsausgaben.strom",
    gas: "betriebsausgaben.gas",
    wasser: "betriebsausgaben.wasser",
    heizung: "betriebsausgaben.heizung",
    reinigung: "betriebsausgaben.reinigung",
    instandhaltung_gebaeude: "betriebsausgaben.instandhaltung_gebaeude",
    grundsteuer: "steuern.grundsteuer",
    sonstige_raumkosten: "betriebsausgaben.nebenkosten_raum",
    arbeitszimmer: null,
    // Fahrzeug
    kfz_leasing: "fahrzeug.leasing",
    kfz_versicherung: "fahrzeug.versicherung",
    kfz_betriebskosten: "fahrzeug.kraftstoff",
    kfz_reparatur: "fahrzeug.reparatur",
    kfz_maut: "fahrzeug.maut",
    kfz_sonstiges: "fahrzeug.sonstiges",
    kfz_steuer: "fahrzeug.kfz_steuer",
    // Reisen & Bewirtung
    reisekosten: "betriebsausgaben.reisekosten",
    uebernachtung: "betriebsausgaben.uebernachtung",
    verpflegung: "betriebsausgaben.verpflegung",
    bewirtung: "betriebsausgaben.bewirtung",
    geschenke: "betriebsausgaben.geschenke",
    trinkgeld: null,
    // Werbung & Marketing
    werbung_online: "betriebsausgaben.marketing",
    werbung_print: "betriebsausgaben.marketing",
    messen: "betriebsausgaben.marketing",
    website: "betriebsausgaben.marketing",
    sponsoring: "betriebsausgaben.marketing",
    verkaufsprovision: "betriebsausgaben.beratung",
    vertriebskosten: "betriebsausgaben.beratung",
    // Versicherungen & Beiträge
    versicherungen: "betriebsausgaben.versicherungen",
    betriebshaftpflicht: "betriebsausgaben.versicherungen",
    rechtsschutz: "betriebsausgaben.versicherungen",
    unfallversicherung: "betriebsausgaben.versicherungen",
    lebensversicherung: "betriebsausgaben.versicherungen",
    berufsverband: "betriebsausgaben.beitraege",
    // Personal
    loehne: "loehne.loehne",
    gehaelter: "loehne.gehaelter",
    sozialabgaben: "loehne.sozialversicherung",
    arbeitskleidung: "betriebsausgaben.arbeitskleidung",
    personalbeschaffung: null,
    fortbildung_personal: "betriebsausgaben.fortbildung",
    // IT
    telefon_internet: "betriebsausgaben.telefon",
    internet: "betriebsausgaben.internet",
    hosting_domain: "betriebsausgaben.hosting_cloud",
    hardware: "anlagevermoegen.it_hardware",
    software_lizenz: "anlagevermoegen.software_lizenzen",
    gwg: "anlagevermoegen.gwg",
    it_zubehoer: "betriebsausgaben.buero",
    // Anlagen
    bueromoebel: "anlagevermoegen.bueromoebel",
    maschinen: "anlagevermoegen.maschinen",
    fahrzeug_kauf: "anlagevermoegen.fahrzeuge",
    immobilie: "anlagevermoegen.gebaeude",
    // Steuern
    gewerbesteuer: "steuern.gewerbesteuer",
    koerperschaftsteuer: null,
    sonstige_steuern: "steuern.sonstige_betriebssteuern",
    // Приватное
    privatentnahme: "privatentnahme.geld",
    privatausgabe: "privatentnahme.ausgaben",
    // Прочее
    sonstiges_allgemein: "betriebsausgaben.beratung",
    spenden: null,
    verluste: null,
    zinsen: null,
};

// ── Сборка данных ──────────────────────────────────────────────────────────────────────────────
const rows = parseCsv(readFileSync(csvPath, "utf8"));
const entries = {};
for (const row of rows) {
    const code = row.code;
    if (!code) throw new Error(`CSV: строка без code (${JSON.stringify(row).slice(0, 120)})`);
    const { line, group } = parseLine(row.euer_line);
    entries[code] = {
        euerLine: line,
        euerKz: parseKz(row.euer_label, line),
        euerLabel: row.euer_label ?? "",
        ustKz: row.ust_kz === "—" ? "" : (row.ust_kz ?? ""),
        group,
        source: code,
    };
}

const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
const aliases = {};
const missing = [];
for (const item of catalog) {
    const target = CRM_TO_ELSTER[item.code];
    if (target === undefined) throw new Error(`Нет решения в CRM_TO_ELSTER для кода CRM «${item.code}» — добавьте код или null`);
    if (target === null) { missing.push(item.code); continue; }
    if (!entries[target]) throw new Error(`CRM «${item.code}» → «${target}»: такого кода нет в ${path.basename(csvPath)}`);
    aliases[item.code] = target;
}
for (const code of Object.keys(CRM_TO_ELSTER)) {
    if (!catalog.some((c) => c.code === code)) throw new Error(`CRM_TO_ELSTER: код «${code}» отсутствует в ${path.basename(catalogPath)}`);
}

// ── Запись TypeScript ──────────────────────────────────────────────────────────────────────────
const json = (value) => JSON.stringify(value, null, 4);
const file = `// ВНИМАНИЕ: файл сгенерирован — не редактируйте вручную.
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

/** Строки Anlage EÜR по коду каталога ELSTER (${Object.keys(entries).length} категорий). */
export const ELSTER_CATEGORY_MAPPING: Record<string, ElsterMappingEntry> = ${json(entries)};

/**
 * Коды справочника CRM → коды каталога ELSTER (${Object.keys(aliases).length} соответствий).
 * ${missing.length} кодов CRM намеренно без соответствия: в CSV нет подходящей категории, выгрузка
 * покажет пустые EÜR-Zeile/Kz и предупреждение. Список: ${missing.join(", ") || "—"}.
 */
export const ELSTER_CRM_ALIASES: Record<string, string> = ${json(aliases)};

/**
 * Строка EÜR и Kz для кода расхода: сначала переходник CRM → ELSTER, затем прямое совпадение
 * с каталогом ELSTER. Alias важнее: у CRM есть лист «privatentnahme» (Geldentnahme), а в CSV
 * этим же словом названа группа; расход хранит код CRM, и ему нужна строка 106, а не «GRUPPE».
 * \`null\` — код неизвестен (в выгрузке это предупреждение).
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
`;

writeFileSync(outPath, file, "utf8");
console.log(`[elster-mapping] ${Object.keys(entries).length} categories, ${Object.keys(aliases).length} CRM aliases, ${missing.length} without mapping`);
console.log(`[elster-mapping] без соответствия: ${missing.join(", ") || "—"}`);
console.log(`[elster-mapping] записано: ${path.relative(ROOT, outPath)}`);
