import qrcode from "qrcode-generator";

// QR-код для оплаты счёта по стандарту EPC069-12 («Girocode»): его понимают приложения банков SEPA — клиент
// сканирует код и получает готовое поручение с IBAN, суммой и назначением платежа. Формат — простой набор
// строк через \n, поэтому собираем его сами, а рисует код обычный pdfkit (см. drawQr в layouts.ts).

export interface PaymentQrData {
    name: string; // получатель — по нему банк проверяет совпадение с владельцем счёта
    iban: string;
    bic?: string; // не обязателен с 2016 года, но банки принимают и с ним
    amount: number; // только EUR: стандарт не разрешает другую валюту
    remittance: string; // назначение платежа — номер документа
    info?: string; // строка «плательщик → получатель», не обязательна
}

// Пробелы в IBAN человек пишет для читаемости, в коде они запрещены
export const normalizeIban = (iban: string) => iban.replace(/\s+/g, "").toUpperCase();

// Стандарт разрешает в назначении платежа не всё: переносы строк и управляющие символы сломали бы формат
const oneLine = (v: string, max: number) => v.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, max);

// Полезная нагрузка Girocode. Версия 002 + кодировка UTF-8 (1) + тип платежа SCT (SEPA Credit Transfer).
// Поля идут строго по порядку, пустые остаются пустыми строками — банк читает их по позиции.
export function epcPayload(d: PaymentQrData): string {
    const amount = Math.max(0, Math.round(d.amount * 100) / 100);
    const fields = [
        "BCD", // служебный префикс формата
        "002", // версия формата
        "1", // кодировка символов: 1 — UTF-8
        "SCT", // SEPA Credit Transfer
        normalizeIban(d.bic ?? ""), // BIC (может быть пустым)
        oneLine(d.name, 70),
        normalizeIban(d.iban),
        `EUR${amount.toFixed(2)}`, // сумма: только EUR, два знака после запятой
        "", // код назначения платежа (не используется)
        "", // ссылка на документ (не используется — назначение идёт текстом)
        oneLine(d.remittance, 140),
        oneLine(d.info ?? "", 70),
    ];
    return fields.join("\n");
}

export interface QrMatrix { size: number; isDark: (row: number, col: number) => boolean }

// Матрица модулей кода. Уровень коррекции M — обычный выбор для печатных документов: до 15% повреждений
// восстанавливается, код остаётся читаемым при печати и скачивании со сжатием.
export function qrMatrix(text: string, errorCorrection: "L" | "M" | "Q" | "H" = "M"): QrMatrix {
    const qr = qrcode(0, errorCorrection);
    // Библиотека кодирует байты как latin1 (charCodeAt & 0xff). Переводим строку в UTF-8 и раскладываем её
    // побайтово в latin1 — тогда в коде окажутся ровно UTF-8 байты, как и обещает заголовок «1» в payload.
    qr.addData(Buffer.from(Buffer.from(text, "utf8")).toString("latin1"), "Byte");
    qr.make();
    const size = qr.getModuleCount();
    return { size, isDark: (row, col) => qr.isDark(row, col) };
}
