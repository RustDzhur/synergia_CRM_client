// Тексты выбора прав специалиста (бухгалтер/юрист) на четырёх языках интерфейса.
import { pickLang, type Lang } from "@/lib/finance/contractFields";

const D = {
	whole: { en: "Whole sections", ua: "Розділи повністю", de: "Ganze Bereiche", uz: "Bo‘limlar to‘liq" },
	fine: { en: "Or pick exactly what the specialist may use", ua: "Або виберіть точно, чим може користуватися спеціаліст", de: "Oder genau auswählen, was der Spezialist nutzen darf", uz: "Yoki mutaxassis nimadan foydalanishini aniq tanlang" },
	fineHint: { en: "If you tick anything below, only the ticked items are open (the AI assistant is switched off for this specialist). If you tick nothing, the whole section is open.", ua: "Якщо позначите щось нижче — відкрито лише позначене (ШІ-помічник для спеціаліста вимкнено). Якщо нічого не позначати — розділ відкрито повністю.", de: "Sobald Sie unten etwas ankreuzen, ist nur das Angekreuzte offen (der KI-Assistent ist dann abgeschaltet). Ohne Auswahl ist der ganze Bereich offen.", uz: "Quyida biror narsani belgilasangiz, faqat belgilanganlar ochiq bo‘ladi (AI yordamchi o‘chiriladi). Hech narsa belgilanmasa, bo‘lim to‘liq ochiq." },
	presets: { en: "Quick presets", ua: "Швидкі набори", de: "Schnellauswahl", uz: "Tez to‘plamlar" },
	presetLawyer: { en: "Lawyer: contracts", ua: "Юрист: договори", de: "Jurist: Verträge", uz: "Yurist: shartnomalar" },
	presetAccountant: { en: "Accountant: invoices + export", ua: "Бухгалтер: рахунки + вивантаження", de: "Buchhalter: Rechnungen + Export", uz: "Buxgalter: hisoblar + eksport" },
	presetFull: { en: "Everything in accounting", ua: "Уся бухгалтерія", de: "Gesamte Buchhaltung", uz: "Butun buxgalteriya" },
	presetClear: { en: "Clear", ua: "Скинути", de: "Zurücksetzen", uz: "Tozalash" },
	g_acc: { en: "Accounting", ua: "Бухгалтерія", de: "Buchhaltung", uz: "Buxgalteriya" },
	g_crm: { en: "Clients (CRM)", ua: "Клієнти (CRM)", de: "Kunden (CRM)", uz: "Mijozlar (CRM)" },
	invoices: { en: "Invoices, quotes, orders", ua: "Рахунки, пропозиції, замовлення", de: "Rechnungen, Angebote, Aufträge", uz: "Hisoblar, takliflar, buyurtmalar" },
	expenses: { en: "Expenses, suppliers, purchases", ua: "Витрати, постачальники, закупівлі", de: "Ausgaben, Lieferanten, Einkauf", uz: "Xarajatlar, yetkazib beruvchilar, xaridlar" },
	bank: { en: "Bank and reconciliation", ua: "Банк і звірка", de: "Bank und Abgleich", uz: "Bank va solishtirish" },
	stock: { en: "Products, stock, production, POS", ua: "Товари, склад, виробництво, каса", de: "Artikel, Lager, Produktion, Kasse", uz: "Tovarlar, ombor, ishlab chiqarish, kassa" },
	reports: { en: "Reports, taxes, period close, review", ua: "Звіти, податки, закриття періоду, перевірка", de: "Berichte, Steuern, Periodenabschluss, Prüfung", uz: "Hisobotlar, soliqlar, davrni yopish, tekshiruv" },
	contracts: { en: "Contracts and contract templates", ua: "Договори та шаблони договорів", de: "Verträge und Vertragsvorlagen", uz: "Shartnomalar va shablonlar" },
	export: { en: "Download / export files", ua: "Завантаження та вивантаження файлів", de: "Dateien herunterladen / exportieren", uz: "Fayllarni yuklab olish / eksport" },
	import: { en: "Upload / import files", ua: "Завантаження та імпорт файлів", de: "Dateien hochladen / importieren", uz: "Fayllarni yuklash / import" },
	clients: { en: "Contacts and companies", ua: "Контакти та компанії", de: "Kontakte und Firmen", uz: "Kontaktlar va kompaniyalar" },
	deals: { en: "Deals", ua: "Угоди", de: "Deals", uz: "Bitimlar" },
} satisfies Record<string, Record<Lang, string>>;

export type PracticeUiKey = keyof typeof D;
export const trPractice = (locale: string) => { const l = pickLang(locale); return (k: PracticeUiKey) => D[k][l]; };
