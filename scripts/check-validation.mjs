// Тесты валидаторов по контрольным значениям (приёмка V0): запускается в scratch-копии до сборки.
//   node scripts/check-validation.mjs
//
// TS-модуль проекта подключается напрямую (маленький require-хук на typescript из node_modules),
// поэтому тесты проверяют именно тот код, что уходит в сборку, а не его копию.
// Контрольные значения: настоящие IBAN из стандарта, USt-IdNr с вычисленной контрольной цифрой,
// заведомо битые номера — валидатор обязан их отвергнуть.

import { createRequire } from "module";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import Module from "module";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const ts = require("typescript");

// ── хук: .ts через транспиляцию, "@/..." → корень проекта ───────────────────────────────────────────
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
    if (request.startsWith("@/")) {
        const p = join(root, request.slice(2));
        for (const cand of [p, p + ".ts", p + ".tsx", join(p, "index.ts")]) {
            try { if (readFileSync(cand)) return origResolve.call(this, cand, parent, ...rest); } catch { /* пробуем дальше */ }
        }
    }
    return origResolve.call(this, request, parent, ...rest);
};
Module._extensions[".ts"] = function (mod, filename) {
    const out = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
    mod._compile(out, filename);
};

const V = require(join(root, "lib/validation/common.ts"));
const UA = require(join(root, "lib/validation/ua.ts"));

let failed = 0;
const check = (label, got, want) => {
    if (got !== want) {
        failed++;
        console.error(`FAIL ${label}: получили ${got}, ждали ${want}`);
    }
};

// ── IBAN: контрольная сумма mod-97 и длина по стране ────────────────────────────────────────────────
check("IBAN DE (пример из стандарта)", V.validIbanAny("DE89 3704 0044 0532 0130 00"), true);
check("IBAN UA (пример Нацбанка)", V.validIbanAny("UA90 3052 9929 9000 4149 1234 56789"), true);
check("IBAN GB (пример из стандарта)", V.validIbanAny("GB29 NWBK 6016 1331 9268 19"), true);
check("IBAN с битой контрольной цифрой", V.validIbanAny("DE89370400440532013001"), false);
check("IBAN неверной длины для страны", V.validIbanAny("DE8937040044053201300"), false);
check("IBAN с чужими символами", V.validIbanAny("DE89-3704-0044"), false);

// ── Немецкий USt-IdNr: контрольная цифра по ISO 7064 (MOD 11,10) ────────────────────────────────────
// Генератор контрольной цифры тем же правилом — на нём проверяем и валидатор, и отказ на подмене
const ustCheck = (base8) => {
    let product = 10;
    for (const ch of base8) {
        let sum = (Number(ch) + product) % 10;
        if (sum === 0) sum = 10;
        product = (sum * 2) % 11;
    }
    let check = 11 - product;
    return check === 10 ? 0 : check;
};
for (const base of ["12345678", "98765432", "20123456"]) {
    const ok = `DE${base}${ustCheck(base)}`;
    const badDigit = (ustCheck(base) + 1) % 10;
    check(`USt-IdNr ${ok}`, V.validUstId(ok), true);
    check(`USt-IdNr ${base} с подменённой цифрой`, V.validUstId(`DE${base}${badDigit}`), false);
}
check("USt-IdNr без префикса DE", V.validUstId("123456789"), false);
check("USt-IdNr с буквами", V.validUstId("DE12345678A"), false);

// ── Прочие поля с контрольными значениями ───────────────────────────────────────────────────────────
check("BIC банка", V.validBic("COBADEFFXXX"), true);
check("BIC короткий", V.validBic("COBADEFF"), true);
check("BIC с цифрой в начале", V.validBic("1OBADEFF"), false);
check("EORI Германии", V.validEori("DE123456789012345"), true);
check("EORI без страны", V.validEori("123456789"), false);
check("HRB", V.validRegisterNumber("HRB 123456"), true);
check("HRA с пробелом", V.validRegisterNumber("HRA 12345"), true);
check("регистр без типа", V.validRegisterNumber("123456"), false);
check("PLZ Берлина", V.validPostcode("10115", "DE"), true);
check("PLZ ниже допустимого", V.validPostcode("01000", "DE"), false);
check("індекс Києва", V.validPostcode("01001", "UA"), true);
check("індекс из 4 цифр", V.validPostcode("0100", "UA"), false);
check("Steuernummer с разделителем", V.validSteuernummer("12/345/67890"), true);
check("телефон украинский", V.validPhone("+380 67 123-45-67"), true);
check("телефон немецкий", V.validPhone("+49 30 123456"), true);
check("телефон из трёх цифр", V.validPhone("123"), false);
check("почта", V.validEmail("buh@example.com.ua"), true);
check("почта без домена", V.validEmail("buh@example"), false);
check("сайт", V.validUrl("https://firmspace.de"), true);
check("дата", V.validDate("2026-09-30"), true);
check("дата в формате 30.09.2026", V.validDate("30.09.2026"), false);
check("ставка 200 %", V.validRate(200), false);

// ── Украинские реквизиты (lib/validation/ua.ts) ─────────────────────────────────────────────────────
check("ЄДРПОУ 8 цифр", UA.uaFieldError("uaEdrpou", "12345678"), null);
check("ЄДРПОУ 7 цифр", UA.uaFieldError("uaEdrpou", "1234567"), "edrpou");
check("ІПН 10 цифр", UA.uaFieldError("uaIpn", "1234567890"), null);
check("ІПН 12 цифр", UA.uaFieldError("uaIpn", "123456789012"), null);
check("ІПН 11 цифр", UA.uaFieldError("uaIpn", "12345678901"), "ipn");
check("IBAN UA верный", UA.uaFieldError("uaIban", "UA903052992990004149123456789"), null);
check("IBAN UA с битой цифрой", UA.uaFieldError("uaIban", "UA903052992990004149123456788"), "iban");
check("МФО 6 цифр", UA.uaFieldError("uaMfo", "322001"), null);
check("КВЕД", UA.uaFieldError("uaKved", "62.01, 63.11"), null);
check("КВЕД из букв", UA.uaFieldError("uaKved", "ABC"), "kved");
check("пустое поле не ошибка", V.fieldError("iban", ""), null);

// ── Система налогообложения ─────────────────────────────────────────────────────────────────────────
check("ФОП без системы → single_3", UA.taxSystemOf({ uaLegalForm: "fop", uaGroup: 3 }), "single_3");
check("ТОВ без системы → general_tov", UA.taxSystemOf({ uaLegalForm: "tov", uaGroup: 0 }), "general_tov");
check("ТОВ 3-я группа → single_tov", UA.taxSystemOf({ uaLegalForm: "tov", uaGroup: 3 }), "single_tov");
check("ФОП, группа 2", UA.taxSystemOf({ uaLegalForm: "fop", uaGroup: 2 }), "single_2");

if (failed) {
    console.error(`\nВсего ошибок: ${failed}`);
    process.exit(1);
}
console.log("Валидаторы: все контрольные значения прошли");
