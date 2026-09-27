import { SectionConfig, seedRecord as rec } from "../shared/records/config";

// База знаний фирмы: статьи с заголовком, текстом и категорией. Вкладки — категории,
// чтобы инструкции лежали по темам, а не одной свалкой. Данные хранит та же машинерия,
// что и остальные таблицы разделов (SectionRecord), поэтому сервер и права уже работают.
export const KNOWLEDGE: SectionConfig = {
	section: "company",
	namespace: "company",
	tabs: ["general", "sales", "finance", "team"],
	fields: {
		general: [
			{ key: "title", type: "text", required: true },
			{ key: "category", type: "select", options: ["process", "tools", "policy", "onboarding"] },
			{ key: "body", type: "text", wide: true },
			{ key: "author", type: "text" },
			{ key: "updated", type: "date" },
		],
		sales: [
			{ key: "title", type: "text", required: true },
			{ key: "category", type: "select", options: ["script", "pricing", "objection", "process"] },
			{ key: "body", type: "text", wide: true },
			{ key: "author", type: "text" },
			{ key: "updated", type: "date" },
		],
		finance: [
			{ key: "title", type: "text", required: true },
			{ key: "category", type: "select", options: ["invoice", "tax", "expenses", "deadlines"] },
			{ key: "body", type: "text", wide: true },
			{ key: "author", type: "text" },
			{ key: "updated", type: "date" },
		],
		team: [
			{ key: "title", type: "text", required: true },
			{ key: "category", type: "select", options: ["onboarding", "holidays", "contacts", "policy"] },
			{ key: "body", type: "text", wide: true },
			{ key: "author", type: "text" },
			{ key: "updated", type: "date" },
		],
	},
	// Стартовые статьи показываются, пока фирма не добавила свои: пустая база знаний выглядит как ошибка,
	// а так видно, что сюда писать и в каком виде.
	seed: {
		general: [
			rec("kb-g1", { title: "Wie diese Wissensdatenbank gedacht ist", category: "process", body: "Legen Sie hier Anleitungen ab, die im Alltag gebraucht werden: wie ein Angebot entsteht, wer was freigibt, wo die Vorlagen liegen. Eine Seite pro Thema, kurze Sätze, без дублирования того, что и так видно в интерфейсе.", author: "", updated: "" }),
			rec("kb-g2", { title: "Wie ein Eintrag aufgebaut sein sollte", category: "tools", body: "Titel = was die Frage ist. Text = die Antwort in Schritten. Verantwortliche Person und Datum der letzten Prüfung gehören dazu, damit klar ist, ob der Eintrag noch aktuell ist.", author: "", updated: "" }),
		],
		sales: [
			rec("kb-s1", { title: "Angebot erstellen und versenden", category: "process", body: "1. Kunde in CRM anlegen oder öffnen.\n2. Angebot im Bereich Finanzen erstellen, Positionen eintragen.\n3. Prüfen, ob Steuersatz und Leistungsdatum stimmen.\n4. Als PDF an den Kunden senden oder herunterladen.", author: "", updated: "" }),
		],
		finance: [
			rec("kb-f1", { title: "Rechnung: was darauf stehen muss", category: "invoice", body: "Vollständiger Firmenname und Anschrift, Steuernummer oder USt-IdNr., Rechnungsdatum, fortlaufende Rechnungsnummer, Leistungsdatum, Art und Menge der Leistung, Nettobetrag, Steuersatz und Steuerbetrag. Bei Kleinunternehmerregelung statt der Steuer der Hinweis nach §19 UStG.", author: "", updated: "" }),
			rec("kb-f2", { title: "Wann gemahnt wird", category: "deadlines", body: "Nach Ablauf des Zahlungsziels wird die Rechnung als überfällig geführt. Die erste Zahlungserinnerung geht nach der eingestellten Frist raus, danach steigt die Mahnstufe. Beträge und Fristen sind im Bereich Finanzen → Einstellungen hinterlegt.", author: "", updated: "" }),
		],
		team: [
			rec("kb-t1", { title: "Neue Kollegin, neuer Kollege", category: "onboarding", body: "1. Mitarbeiter im Bereich Meine Firma eintragen.\n2. Zugang in Einstellungen → Team anlegen (E-Mail, Rolle, Module).\n3. Ohne Konto bleibt der Eintrag ein reiner Verzeichniseintrag: er erscheint in Listen, kann aber keine Aufgaben bearbeiten.", author: "", updated: "" }),
		],
	},
};
