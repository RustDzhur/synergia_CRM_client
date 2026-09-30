// Чтение и запись CSV для мастера импорта/экспорта (ТЗ §17).
//
// Читатель намеренно терпимый: файлы приходят из Excel (разделитель `;`), из Google Sheets (`,`),
// из 1С (табуляция), с BOM, в кавычках и с переносами строк внутри кавычек. Задача — не «соблюсти
// RFC 4180», а не потерять строку данных: пропущенная строка каталога — это непроданный товар.

export interface ParsedCsv {
    columns: string[];
    rows: string[][];
    delimiter: string;
}

// Определение разделителя по первой строке: побеждает тот, что встречается чаще вне кавычек
function detectDelimiter(head: string): string {
    const candidates = [";", ",", "\t", "|"];
    let best = ",";
    let bestCount = 0;
    for (const d of candidates) {
        let count = 0;
        let quoted = false;
        for (const ch of head) {
            if (ch === '"') quoted = !quoted;
            else if (ch === d && !quoted) count++;
        }
        if (count > bestCount) {
            best = d;
            bestCount = count;
        }
    }
    return best;
}

/** Разбор CSV в заголовок и строки. Заголовок — первая непустая строка. */
export function parseCsv(text: string): ParsedCsv {
    const clean = text.replace(/^﻿/, ""); // Excel пишет BOM — он ломает имя первой колонки
    const firstLine = clean.split("\n")[0] ?? "";
    const delimiter = detectDelimiter(firstLine);

    const records: string[][] = [];
    let field = "";
    let row: string[] = [];
    let quoted = false;
    const src = clean.replace(/\r\n?/g, "\n");

    for (let i = 0; i < src.length; i++) {
        const ch = src[i];
        if (quoted) {
            if (ch === '"') {
                if (src[i + 1] === '"') { field += '"'; i++; } // удвоенная кавычка внутри значения
                else quoted = false;
            } else field += ch;
            continue;
        }
        if (ch === '"') { quoted = true; continue; }
        if (ch === delimiter) { row.push(field); field = ""; continue; }
        if (ch === "\n") {
            row.push(field);
            field = "";
            records.push(row);
            row = [];
            continue;
        }
        field += ch;
    }
    if (field || row.length) { row.push(field); records.push(row); }

    // Пустые строки (частая хвостовая) не считаются данными
    const nonEmpty = records.filter((r) => r.some((c) => c.trim() !== ""));
    const columns = (nonEmpty.shift() ?? []).map((c) => c.trim());
    const width = columns.length;
    // Хвостовые пустые колонки укорачиваем, недостающие добиваем пустыми: строки обязаны быть ровными
    const rows = nonEmpty.map((r) => {
        const cut = r.slice(0, width);
        while (cut.length < width) cut.push("");
        return cut;
    });
    return { columns, rows, delimiter };
}

const quote = (v: string) => (/[";\n\r,]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Запись CSV: разделитель `;` (Excel в Европе открывает его двойным щелчком), BOM — для Excel. */
export function toCsv(columns: string[], rows: Array<Array<string | number>>): string {
    const head = columns.map(quote).join(";");
    const body = rows.map((r) => r.map((c) => quote(String(c ?? ""))).join(";")).join("\r\n");
    return "﻿" + head + "\r\n" + body + "\r\n";
}
