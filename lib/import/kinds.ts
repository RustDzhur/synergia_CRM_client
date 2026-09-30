import type { FieldCode } from "@/lib/validation/common";

// Что умеет импортёр и какие колонки он понимает (ТЗ §17).
//
// Поля описаны один раз: имя в базе, подпись для сопоставления, проверка из общего слоя валидации
// (ТЗ §15) и синонимы заголовков. Синонимы — на четырёх языках сразу (файлы приходят из 1С, Excel,
// Google Sheets на разных языках): по ним мастер сам угадывает сопоставление, а человек может
// поправить его в окне. Обязательные поля помечены звёздочкой в подписи.

export type ImportKind = "products" | "contacts" | "companies" | "stock";

export interface TargetField {
    key: string;
    label: string; // подпись в окне сопоставления
    required?: boolean;
    code?: FieldCode; // проверка значения (коды ошибок — lib/validation/common.ts)
    aliases: string[]; // варианты заголовков колонок
}

export interface KindDef {
    kind: ImportKind;
    label: string; // подпись вкладки мастера
    matchBy: string[]; // по этим полям ищем существующую запись (в порядке приоритета)
    fields: TargetField[];
}

export const IMPORT_KINDS: Record<ImportKind, KindDef> = {
    products: {
        kind: "products",
        label: "Каталог товаров",
        // Обновление по SKU или внешнему id — как в ТЗ: повторный импорт не плодит дубли
        matchBy: ["sku", "name"],
        fields: [
            { key: "name", label: "Название", required: true, aliases: ["name", "название", "найменування", "наименование", "bezeichnung", "товар", "product"] },
            { key: "sku", label: "SKU / Артикул", aliases: ["sku", "артикул", "код", "code", "artikel", "article", "код товару"] },
            { key: "type", label: "Тип (good/service)", aliases: ["type", "тип", "вид", "typ"] },
            { key: "unit", label: "Единица", aliases: ["unit", "ед", "единица", "од", "einheit", "measure"] },
            { key: "purchasePrice", label: "Закупочная цена", code: "amount", aliases: ["purchaseprice", "закупочная", "закупівельна", "цена закупки", "ek", "einkaufspreis", "cost"] },
            { key: "salePrice", label: "Цена продажи", code: "amount", aliases: ["saleprice", "цена", "ціна", "preis", "price", "цена продажи"] },
            { key: "taxRate", label: "Ставка налога, %", code: "rate", aliases: ["taxrate", "ставка", "пдв", "ндс", "mwst", "ust", "vat"] },
            { key: "stockQty", label: "Остаток (приход)", code: "amount", aliases: ["stockqty", "остаток", "залишок", "наявність", "кількість", "количество", "bestand", "qty", "quantity"] },
            { key: "reorderLevel", label: "Минимальный остаток", code: "amount", aliases: ["reorderlevel", "минимум", "мінімум", "mindestbestand"] },
            { key: "image", label: "Картинка (URL)", aliases: ["image", "картинка", "зображення", "изображение", "bild", "photo", "фото"] },
        ],
    },
    contacts: {
        kind: "contacts",
        label: "Контакты",
        matchBy: ["email", "phone", "name"],
        fields: [
            { key: "name", label: "Имя", required: true, aliases: ["name", "имя", "ім'я", "фио", "піб", "kontakt", "contact"] },
            { key: "email", label: "Почта", code: "email", aliases: ["email", "почта", "пошта", "mail", "e-mail"] },
            { key: "phone", label: "Телефон", code: "phone", aliases: ["phone", "телефон", "tel", "моб", "mobile"] },
            { key: "position", label: "Должность", aliases: ["position", "должность", "посада", "role", "роль"] },
            { key: "company", label: "Компания (текст)", aliases: ["company", "компания", "компанія", "firma", "организация"] },
            { key: "website", label: "Сайт", code: "url", aliases: ["website", "сайт", "site", "web"] },
            { key: "notes", label: "Заметки", aliases: ["notes", "заметки", "нотатки", "notiz", "комментарий"] },
        ],
    },
    companies: {
        kind: "companies",
        label: "Фирмы (клиенты)",
        matchBy: ["code", "name"],
        fields: [
            { key: "name", label: "Название", required: true, aliases: ["name", "название", "назва", "наименование", "firma", "company"] },
            { key: "code", label: "ЄДРПОУ / USt-IdNr", aliases: ["code", "код", "єдрпоу", "едрпоу", "ust-idnr", "ustid", "vatid", "vat"] },
            { key: "status", label: "Статус", aliases: ["status", "статус"] },
            { key: "address", label: "Адрес", aliases: ["address", "адрес", "адреса", "anschrift", "contacts"] },
            { key: "email", label: "Почта", code: "email", aliases: ["email", "почта", "пошта", "mail"] },
            { key: "registrationDate", label: "Дата регистрации", code: "date", aliases: ["registrationdate", "дата регистрации", "дата реєстрації"] },
            { key: "authorisedPerson", label: "Руководитель", aliases: ["authorisedperson", "руководитель", "керівник", "director", "geschäftsführer"] },
            { key: "businessType", label: "Вид деятельности", aliases: ["businesstype", "вид деятельности", "вид діяльності"] },
        ],
    },
    stock: {
        kind: "stock",
        label: "Остатки (приход)",
        // Остатки обновляются только движениями; строка ищет товар и делает приход документом «Імпорт»
        matchBy: ["sku", "name"],
        fields: [
            { key: "name", label: "Название товара", aliases: ["name", "название", "найменування", "bezeichnung", "товар"] },
            { key: "sku", label: "SKU / Артикул", aliases: ["sku", "артикул", "код", "artikel"] },
            { key: "qty", label: "Количество", required: true, code: "amount", aliases: ["qty", "quantity", "кількість", "количество", "остаток", "bestand"] },
            { key: "cost", label: "Себестоимость за единицу", code: "amount", aliases: ["cost", "цена", "ціна", "себестоимость", "ek", "einkaufspreis"] },
        ],
    },
};

/** Нормализация заголовка для сопоставления: регистр, пробелы, подчёркивания, кавычки. */
export const normalizeHeader = (h: string) => h.trim().toLowerCase().replace(/[«»"'`]/g, "").replace(/[\s_-]+/g, "");

/** Угадать сопоставление: колонка → поле. Точное совпадение с синонимом, затем вхождение. */
export function guessMapping(kind: ImportKind, columns: string[]): Record<string, string> {
    const def = IMPORT_KINDS[kind];
    const mapping: Record<string, string> = {};
    const taken = new Set<string>();
    for (const column of columns) {
        const norm = normalizeHeader(column);
        if (!norm) continue;
        const exact = def.fields.find((f) => !taken.has(f.key) && f.aliases.some((a) => normalizeHeader(a) === norm));
        const partial = exact ?? def.fields.find((f) => !taken.has(f.key) && f.aliases.some((a) => norm.includes(normalizeHeader(a)) || normalizeHeader(a).includes(norm)));
        if (partial) {
            mapping[column] = partial.key;
            taken.add(partial.key);
        }
    }
    return mapping;
}
