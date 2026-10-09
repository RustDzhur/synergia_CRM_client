// Тексты редактора шаблонов договоров и формы договора на четырёх языках интерфейса.
import { pickLang, type Lang } from "@/lib/finance/contractFields";

const D = {
	templates: { en: "Contract templates", ua: "Шаблони договорів", de: "Vertragsvorlagen", uz: "Shartnoma shablonlari" },
	newTemplate: { en: "New template", ua: "Новий шаблон", de: "Neue Vorlage", uz: "Yangi shablon" },
	importFile: { en: "Upload file (.docx, .txt)", ua: "Завантажити файл (.docx, .txt)", de: "Datei hochladen (.docx, .txt)", uz: "Fayl yuklash (.docx, .txt)" },
	imported: { en: "Text loaded from the file", ua: "Текст із файлу завантажено", de: "Text aus der Datei geladen", uz: "Fayldan matn yuklandi" },
	importFailed: { en: "Could not read the file", ua: "Не вдалося прочитати файл", de: "Datei konnte nicht gelesen werden", uz: "Faylni o‘qib bo‘lmadi" },
	empty: { en: "No templates yet. Create the first one: upload the lawyer’s file or paste the text, then drag fields into it.", ua: "Шаблонів ще немає. Створіть перший: завантажте файл юриста або вставте текст і перетягніть у нього поля.", de: "Noch keine Vorlagen. Legen Sie die erste an: Datei des Juristen hochladen oder Text einfügen und Felder hineinziehen.", uz: "Hali shablon yo‘q. Birinchisini yarating: yurist faylini yuklang yoki matnni qo‘ying va maydonlarni sudrab qo‘ying." },
	ownFields: { en: "custom fields", ua: "власних полів", de: "eigene Felder", uz: "o‘z maydonlari" },
	edit: { en: "Edit", ua: "Змінити", de: "Bearbeiten", uz: "Tahrirlash" },
	editTemplate: { en: "Edit template", ua: "Змінити шаблон", de: "Vorlage bearbeiten", uz: "Shablonni tahrirlash" },
	nameLabel: { en: "Template name (e.g. “Lease agreement”)", ua: "Назва шаблону (наприклад, «Договір оренди»)", de: "Name der Vorlage (z. B. „Mietvertrag“)", uz: "Shablon nomi (masalan, «Ijara shartnomasi»)" },
	nameRequired: { en: "Enter the template name", ua: "Вкажіть назву шаблону", de: "Name der Vorlage angeben", uz: "Shablon nomini kiriting" },
	saved: { en: "Saved", ua: "Збережено", de: "Gespeichert", uz: "Saqlandi" },
	back: { en: "Back", ua: "Назад", de: "Zurück", uz: "Orqaga" },
	save: { en: "Save", ua: "Зберегти", de: "Speichern", uz: "Saqlash" },
	paletteTitle: { en: "Fields — drag into the text or click", ua: "Поля — перетягніть у текст або клікніть", de: "Felder – in den Text ziehen oder klicken", uz: "Maydonlar — matnga sudrang yoki bosing" },
	search: { en: "Search fields (name, passport, IBAN…)", ua: "Пошук поля (ім’я, паспорт, IBAN…)", de: "Feld suchen (Name, Pass, IBAN …)", uz: "Maydon qidirish (ism, pasport, IBAN …)" },
	allCountries: { en: "All countries", ua: "Усі країни", de: "Alle Länder", uz: "Barcha davlatlar" },
	forCountry: { en: "My country + common", ua: "Моя країна + загальні", de: "Mein Land + allgemein", uz: "Mening davlatim + umumiy" },
	yourText: { en: "Contract text", ua: "Текст договору", de: "Vertragstext", uz: "Shartnoma matni" },
	placeholder: { en: "Paste the contract text. Drag a field into the right place, e.g. {{customer}} or {{customerPassportFull}}.", ua: "Вставте текст договору. У потрібне місце перетягніть поле, наприклад {{customer}} або {{customerPassportFull}}.", de: "Vertragstext einfügen. Ziehen Sie ein Feld an die richtige Stelle, z. B. {{customer}} oder {{customerPassportFull}}.", uz: "Shartnoma matnini qo‘ying. Kerakli joyga maydonni sudrang, masalan {{customer}} yoki {{customerPassportFull}}." },
	preview: { en: "Preview with sample data", ua: "Попередній перегляд із прикладом даних", de: "Vorschau mit Beispieldaten", uz: "Namunaviy ma’lumot bilan ko‘rish" },
	previewOff: { en: "Back to editing", ua: "Повернутися до редагування", de: "Zurück zum Bearbeiten", uz: "Tahrirlashga qaytish" },
	unknown: { en: "Unknown fields (stay as written in the PDF):", ua: "Невідомі поля (залишаться в PDF як написано):", de: "Unbekannte Felder (bleiben im PDF stehen):", uz: "Noma’lum maydonlar (PDF da yozilgandek qoladi):" },
	used: { en: "fields in the text", ua: "полів у тексті", de: "Felder im Text", uz: "matndagi maydonlar" },
	customFields: { en: "Custom fields (anything not in the list)", ua: "Власні поля (усе, чого немає в списку)", de: "Eigene Felder (alles, was nicht in der Liste ist)", uz: "O‘z maydonlari (ro‘yxatda yo‘q narsalar)" },
	addField: { en: "Add field", ua: "Додати поле", de: "Feld hinzufügen", uz: "Maydon qo‘shish" },
	key: { en: "Key (latin letters)", ua: "Ключ (латиницею)", de: "Schlüssel (lateinisch)", uz: "Kalit (lotincha)" },
	label: { en: "Label", ua: "Підпис", de: "Bezeichnung", uz: "Nomi" },
	fromCard: { en: "from the client card", ua: "з картки клієнта", de: "aus der Kundenkarte", uz: "mijoz kartasidan" },
	firmTitle: { en: "Your firm’s details for contracts", ua: "Реквізити вашої фірми для договорів", de: "Daten Ihrer Firma für Verträge", uz: "Firmangiz rekvizitlari" },
	firmHint: { en: "Filled from the accounting settings. Add what is missing: position and basis of the signer, registration numbers, bank codes.", ua: "Підставляються з налаштувань бухгалтерії. Додайте те, чого бракує: посаду й підставу підписанта, реєстраційні номери, банківські коди.", de: "Wird aus den Buchhaltungseinstellungen übernommen. Ergänzen Sie, was fehlt: Position und Befugnis des Unterzeichners, Registernummern, Bankcodes.", uz: "Buxgalteriya sozlamalaridan olinadi. Yetishmaganini qo‘shing: imzolovchi lavozimi va asosi, ro‘yxat raqamlari, bank kodlari." },
	firmSave: { en: "Save firm details", ua: "Зберегти реквізити фірми", de: "Firmendaten speichern", uz: "Firma rekvizitlarini saqlash" },
	autoFields: { en: "Auto fields active", ua: "Авто-поля активні", de: "Auto-Felder aktiv", uz: "Avto-maydonlar faol" },
	styleNormal: { en: "Normal", ua: "Звичайний", de: "Normal", uz: "Oddiy" },
	// форма договора
	dataTitle: { en: "Contract data", ua: "Дані для договору", de: "Vertragsdaten", uz: "Shartnoma ma’lumotlari" },
	dataHint: { en: "Taken from the client card and your settings. Fill the highlighted ones — they are empty.", ua: "Взято з картки клієнта та ваших налаштувань. Заповніть підсвічені — вони порожні.", de: "Aus Kundenkarte und Einstellungen übernommen. Füllen Sie die markierten aus – sie sind leer.", uz: "Mijoz kartasi va sozlamalardan olindi. Belgilanganlarni to‘ldiring — ular bo‘sh." },
	saveToCard: { en: "Save the client’s details to his card", ua: "Зберегти дані клієнта в його картку", de: "Kundendaten in der Kundenkarte speichern", uz: "Mijoz ma’lumotlarini kartaga saqlash" },
	missing: { en: "empty", ua: "порожньо", de: "leer", uz: "bo‘sh" },
} satisfies Record<string, Record<Lang, string>>;

export type UiKey = keyof typeof D;
export const trFor = (locale: string) => { const l = pickLang(locale); return (k: UiKey) => D[k][l]; };
