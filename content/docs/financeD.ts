import { t3 } from "../i18n";
import type { DocSection } from "./types";

// Финансы, часть 4: налоги, отчёты, настройки бухгалтерии, журнал изменений.
export const FINANCE_D: DocSection[] = [
	{
		id: "finance_reports",
		title: t3("Finance: taxes and reports", "Finanzen: Steuern und Berichte", "Фінанси: податки та звіти"),
		intro: t3(
			"The tabs [[finance.tab_vat]], [[finance.tab_eur]], [[finance.tab_bwa]] and [[finance.tab_susa]] calculate management figures from your invoices, expenses and assets. They help you prepare, but they are not bookkeeping: a tax adviser must check the numbers before they are filed ([[finance.reportDisclaimer]]).",
			"Die Tabs [[finance.tab_vat]], [[finance.tab_eur]], [[finance.tab_bwa]] und [[finance.tab_susa]] berechnen Managementzahlen aus Ihren Rechnungen, Ausgaben und Anlagen. Sie helfen bei der Vorbereitung, sind aber keine Buchführung: Ein Steuerberater muss die Zahlen vor der Abgabe prüfen ([[finance.reportDisclaimer]]).",
			"Вкладки [[finance.tab_vat]], [[finance.tab_eur]], [[finance.tab_bwa]] і [[finance.tab_susa]] розраховують управлінські показники за вашими рахунками, витратами й активами. Вони допомагають підготуватися, але це не бухгалтерський облік: податковий консультант має перевірити цифри перед поданням ([[finance.reportDisclaimer]]).",
		),
		groups: [
			{
				title: t3("Period switch", "Zeitraum-Umschalter", "Перемикач періоду"),
				steps: [
					t3(
						"Every report has the switch [[finance.period_month]] / [[finance.period_quarter]] / [[finance.period_year]]. It always refers to the current calendar month, quarter or year; the exact range is written next to it ([[finance.periodLabel]]).",
						"Jeder Bericht hat den Umschalter [[finance.period_month]] / [[finance.period_quarter]] / [[finance.period_year]]. Er bezieht sich immer auf den aktuellen Kalendermonat, das Quartal oder das Jahr; der genaue Bereich steht daneben ([[finance.periodLabel]]).",
						"Кожен звіт має перемикач [[finance.period_month]] / [[finance.period_quarter]] / [[finance.period_year]]. Він завжди стосується поточного календарного місяця, кварталу чи року; точний діапазон написано поруч ([[finance.periodLabel]]).",
					),
				],
			},
			{
				title: t3("VAT return (UStVA)", "Umsatzsteuer-Voranmeldung (UStVA)", "ПДВ-декларація (UStVA)"),
				steps: [
					t3(
						"Open [[finance.tab_vat]] ([[finance.vatTitle]]). Turnover is counted by the issue date of the invoice (Soll-Versteuerung). Drafts and cancelled invoices are left out; credit notes are subtracted.",
						"Öffnen Sie [[finance.tab_vat]] ([[finance.vatTitle]]). Der Umsatz wird nach dem Ausstellungsdatum der Rechnung gezählt (Soll-Versteuerung). Entwürfe und stornierte Rechnungen bleiben außen vor; Gutschriften werden abgezogen.",
						"Відкрийте [[finance.tab_vat]] ([[finance.vatTitle]]). Обіг рахується за датою виписки рахунку (Soll-Versteuerung). Чернетки й скасовані рахунки не враховуються; кредит-ноти віднімаються.",
					),
					t3(
						"Two tables, [[finance.vatSalesTitle]] and [[finance.vatInputTitle]], each list the tax rates with [[finance.colRate]], [[finance.colNet]] and [[finance.taxTotal]]. Under them the summary shows [[finance.vatSalesTax]], [[finance.vatInputTax]] and the result: [[finance.vatPayable]] or [[finance.vatRefund]].",
						"Zwei Tabellen, [[finance.vatSalesTitle]] und [[finance.vatInputTitle]], listen je die Steuersätze mit [[finance.colRate]], [[finance.colNet]] und [[finance.taxTotal]]. Darunter zeigt die Zusammenfassung [[finance.vatSalesTax]], [[finance.vatInputTax]] und das Ergebnis: [[finance.vatPayable]] oder [[finance.vatRefund]].",
						"Дві таблиці, [[finance.vatSalesTitle]] і [[finance.vatInputTitle]], перелічують ставки з [[finance.colRate]], [[finance.colNet]] і [[finance.taxTotal]]. Нижче підсумок показує [[finance.vatSalesTax]], [[finance.vatInputTax]] і результат: [[finance.vatPayable]] або [[finance.vatRefund]].",
					),
					t3(
						"The block [[finance.elsterTitle]] (hint [[finance.elsterHint]]) shows the figures ready for the ELSTER form, each with a chip \"Kz N\": Kz 81 (turnover at 19 %), Kz 86 (turnover at 7 %), Kz 43 (zero-rated or tax-free turnover), Kz 66 (input tax), Kz 83 (amount payable) or Kz 84 (refund).",
						"Der Block [[finance.elsterTitle]] (Hinweis [[finance.elsterHint]]) zeigt die Werte für das ELSTER-Formular, jeweils mit einem Chip „Kz N“: Kz 81 (Umsatz zu 19 %), Kz 86 (Umsatz zu 7 %), Kz 43 (steuerfreier oder nullbesteuerter Umsatz), Kz 66 (Vorsteuer), Kz 83 (Zahllast) oder Kz 84 (Erstattung).",
						"Блок [[finance.elsterTitle]] (підказка [[finance.elsterHint]]) показує значення для форми ELSTER, кожне з чипом «Kz N»: Kz 81 (обіг за 19 %), Kz 86 (обіг за 7 %), Kz 43 (обіг з нульовою ставкою чи без ПДВ), Kz 66 (вхідний ПДВ), Kz 83 (до сплати) або Kz 84 (відшкодування).",
					),
					t3(
						"The block [[finance.warningTitle]] lists hints when something needs a look: the small business exemption, mixed rates in one period, invoices to customers with a VAT ID (possible intra-EU supplies), or no turnover and no expenses at all.",
						"Der Block [[finance.warningTitle]] listet Hinweise, wenn etwas einen Blick braucht: die Kleinunternehmerregelung, gemischte Sätze in einem Zeitraum, Rechnungen an Kunden mit USt-IdNr. (mögliche innergemeinschaftliche Lieferungen) oder gar kein Umsatz und keine Ausgaben.",
						"Блок [[finance.warningTitle]] перелічує підказки, коли щось потребує уваги: звільнення малого підприємця, змішані ставки в одному періоді, рахунки клієнтам з VAT ID (можливі внутрішньоєвропейські поставки) або відсутність обігу й витрат.",
					),
					t3(
						"With the small business exemption turned on, an info banner ([[finance.vatExempt]]) says that no VAT return is due and the numbers are for information only.",
						"Ist die Kleinunternehmerregelung aktiv, sagt ein Info-Banner ([[finance.vatExempt]]), dass keine Umsatzsteuer-Voranmeldung fällig ist und die Zahlen nur zur Information dienen.",
						"Якщо ввімкнено звільнення малого підприємця, інформаційний банер ([[finance.vatExempt]]) повідомляє, що ПДВ-декларація не потрібна, а цифри лише довідкові.",
					),
				],
			},
			{
				title: t3("Income and expense statement (EÜR)", "Einnahmen-Überschuss-Rechnung (EÜR)", "Звіт доходів і витрат (EÜR)"),
				steps: [
					t3(
						"Open [[finance.tab_eur]] ([[finance.eurTitle]]). Income is the paid invoices counted by the payment date, less credit notes. Expenses are grouped by category, with the depreciation of assets as a separate line. Each block ends with [[finance.total]].",
						"Öffnen Sie [[finance.tab_eur]] ([[finance.eurTitle]]). Einnahmen sind die bezahlten Rechnungen nach Zahlungsdatum, abzüglich Gutschriften. Ausgaben sind nach Kategorie gruppiert, die Abschreibung der Anlagen steht als eigene Zeile. Jeder Block endet mit [[finance.total]].",
						"Відкрийте [[finance.tab_eur]] ([[finance.eurTitle]]). Доходи — оплачені рахунки за датою оплати мінус кредит-ноти. Витрати згруповані за категоріями, амортизація активів — окремим рядком. Кожен блок завершується рядком [[finance.total]].",
					),
					t3(
						"The bottom line is [[finance.kpiProfit]]; when the result is negative it is shown in red as [[finance.lossLabel]].",
						"Die Schlusszeile ist [[finance.kpiProfit]]; bei einem negativen Ergebnis steht sie in Rot als [[finance.lossLabel]].",
						"Підсумковий рядок — [[finance.kpiProfit]]; якщо результат від'ємний, він показаний червоним як [[finance.lossLabel]].",
					),
				],
			},
			{
				title: t3("BWA and trial balance (SuSa)", "BWA und Summen- und Saldenliste (SuSa)", "BWA та оборотно-сальдова відомість (SuSa)"),
				steps: [
					t3(
						"[[finance.tab_bwa]] ([[finance.bwaTitle]]) shows the chart [[finance.bwaChartTitle]] with revenue against costs per month and a legend; the table with [[finance.colMonth]], [[finance.bwaRevenue]], [[finance.bwaCosts]] and [[finance.kpiProfit]] with a totals row; and the block [[finance.bwaCostBreakdown]] by category with the percentage and the amount.",
						"[[finance.tab_bwa]] ([[finance.bwaTitle]]) zeigt das Diagramm [[finance.bwaChartTitle]] mit Umsatz gegen Kosten pro Monat samt Legende; die Tabelle mit [[finance.colMonth]], [[finance.bwaRevenue]], [[finance.bwaCosts]] und [[finance.kpiProfit]] mit einer Summenzeile; und den Block [[finance.bwaCostBreakdown]] nach Kategorie mit Prozentanteil und Betrag.",
						"[[finance.tab_bwa]] ([[finance.bwaTitle]]) показує діаграму [[finance.bwaChartTitle]] з доходом проти витрат за місяцями та легендою; таблицю з [[finance.colMonth]], [[finance.bwaRevenue]], [[finance.bwaCosts]] і [[finance.kpiProfit]] з рядком підсумків; та блок [[finance.bwaCostBreakdown]] за категоріями з відсотком і сумою.",
					),
					t3(
						"[[finance.tab_susa]] ([[finance.susaTitle]]) is a management trial balance built from receivables, revenue by tax rate, payables and tax. The table has [[finance.colAccount]], [[finance.colName]], [[finance.colDebit]], [[finance.colCredit]] and [[finance.colBalance]], with totals at the end.",
						"[[finance.tab_susa]] ([[finance.susaTitle]]) ist eine betriebswirtschaftliche Summen- und Saldenliste aus Forderungen, Umsatz nach Steuersatz, Verbindlichkeiten und Steuer. Die Tabelle hat [[finance.colAccount]], [[finance.colName]], [[finance.colDebit]], [[finance.colCredit]] und [[finance.colBalance]], am Ende mit Summen.",
						"[[finance.tab_susa]] ([[finance.susaTitle]]) — управлінська оборотно-сальдова відомість із дебіторки, доходу за ставками податку, кредиторки та податку. Таблиця має [[finance.colAccount]], [[finance.colName]], [[finance.colDebit]], [[finance.colCredit]] і [[finance.colBalance]], наприкінці з підсумками.",
					),
				],
			},
			{
				title: t3("Analysis with AI", "Analyse mit KI", "Аналіз за допомогою ШІ"),
				steps: [
					t3(
						"Under each report (UStVA, EÜR, BWA, SuSa) there is the button [[finance.aiAnalyze]]; while it works it says [[finance.aiAnalyzing]]. The result appears in a card titled [[finance.aiTitle]].",
						"Unter jedem Bericht (UStVA, EÜR, BWA, SuSa) steht die Schaltfläche [[finance.aiAnalyze]]; währenddessen steht dort [[finance.aiAnalyzing]]. Das Ergebnis erscheint in einer Karte mit dem Titel [[finance.aiTitle]].",
						"Під кожним звітом (UStVA, EÜR, BWA, SuSa) є кнопка [[finance.aiAnalyze]]; під час роботи вона показує [[finance.aiAnalyzing]]. Результат з'являється в картці з заголовком [[finance.aiTitle]].",
					),
					t3(
						"The request counts against the daily AI limit of your plan. If the limit is used up you see [[finance.aiLimit]]; if the AI is not configured on the platform [[finance.aiNotConfigured]]; any other failure gives [[finance.aiFailed]].",
						"Die Anfrage zählt auf das tägliche KI-Limit Ihres Tarifs. Ist das Limit aufgebraucht, sehen Sie [[finance.aiLimit]]; ist die KI auf der Plattform nicht eingerichtet, [[finance.aiNotConfigured]]; jeder andere Fehler ergibt [[finance.aiFailed]].",
						"Запит рахується в добовий ліміт ШІ вашого тарифу. Якщо ліміт вичерпано, ви побачите [[finance.aiLimit]]; якщо ШІ на платформі не налаштовано — [[finance.aiNotConfigured]]; будь-який інший збій дає [[finance.aiFailed]].",
					),
				],
			},
		],
	},
	{
		id: "finance_settings",
		title: t3("Finance: settings and audit log", "Finanzen: Einstellungen und Protokoll", "Фінанси: налаштування та журнал"),
		intro: t3(
			"The tab [[finance.tab_settings]] holds everything that goes into your documents: legal data, logo, footer, design, numbering and dunning fees. It is one form with a single button [[finance.save]] at the bottom; after saving the message [[finance.saved]] appears.",
			"Der Tab [[finance.tab_settings]] enthält alles, was in Ihre Dokumente einfließt: Firmendaten, Logo, Fußzeile, Layout, Nummerierung und Mahngebühren. Es ist ein Formular mit einer Schaltfläche [[finance.save]] unten; nach dem Speichern erscheint die Meldung [[finance.saved]].",
			"Вкладка [[finance.tab_settings]] містить усе, що потрапляє у ваші документи: реквізити, логотип, підвал, макет, нумерацію і комісії за нагадування. Це одна форма з єдиною кнопкою [[finance.save]] унизу; після збереження з'являється повідомлення [[finance.saved]].",
		),
		groups: [
			{
				title: t3("Tax and company data", "Steuer und Firmendaten", "Податки та дані компанії"),
				steps: [
					t3(
						"Section [[finance.taxSection]]: choose the [[finance.country]] (the option [[finance.countryNone]] means 0 % by default) — its standard VAT rate is used for new lines; enter the [[finance.currency]] (it is converted to upper case). The checkbox [[finance.smallBusiness]] switches every line to 0 % and prints the §19 note on documents (hint [[finance.smallBusinessHint]]).",
						"Abschnitt [[finance.taxSection]]: Wählen Sie das [[finance.country]] (die Option [[finance.countryNone]] bedeutet standardmäßig 0 %) — sein Regelsteuersatz gilt für neue Zeilen; geben Sie die [[finance.currency]] ein (sie wird in Großbuchstaben umgewandelt). Das Kästchen [[finance.smallBusiness]] setzt jede Zeile auf 0 % und druckt den Hinweis nach §19 auf Dokumente (Hinweis [[finance.smallBusinessHint]]).",
						"Розділ [[finance.taxSection]]: оберіть [[finance.country]] (варіант [[finance.countryNone]] означає 0 % за замовчуванням) — його стандартна ставка ПДВ застосовується до нових рядків; введіть [[finance.currency]] (вона перетворюється на великі літери). Прапорець [[finance.smallBusiness]] ставить кожен рядок на 0 % і друкує примітку за §19 на документах (підказка [[finance.smallBusinessHint]]).",
					),
					t3(
						"Section [[finance.companySection]]: [[finance.legalName]], [[finance.address]], [[finance.taxId]], [[finance.vatId]], [[finance.registerNumber]], [[finance.managingDirector]], IBAN and BIC. These go into the header and the footer of the PDFs.",
						"Abschnitt [[finance.companySection]]: [[finance.legalName]], [[finance.address]], [[finance.taxId]], [[finance.vatId]], [[finance.registerNumber]], [[finance.managingDirector]], IBAN und BIC. Sie erscheinen in Kopf und Fuß der PDFs.",
						"Розділ [[finance.companySection]]: [[finance.legalName]], [[finance.address]], [[finance.taxId]], [[finance.vatId]], [[finance.registerNumber]], [[finance.managingDirector]], IBAN і BIC. Вони потрапляють у шапку й підвал PDF.",
					),
					t3(
						"Section [[finance.contactSection]]: [[finance.phone]], [[finance.email]] and [[finance.website]].",
						"Abschnitt [[finance.contactSection]]: [[finance.phone]], [[finance.email]] und [[finance.website]].",
						"Розділ [[finance.contactSection]]: [[finance.phone]], [[finance.email]] і [[finance.website]].",
					),
				],
			},
			{
				title: t3("Documents: logo, footer, design", "Dokumente: Logo, Fußzeile, Layout", "Документи: логотип, підвал, макет"),
				steps: [
					t3(
						"Section [[finance.documentSection]]: [[finance.logoUpload]] chooses an image (up to 5 MB; it is resized automatically, hint [[finance.logoHint]]) and shows a preview; [[finance.logoRemove]] deletes it. The field [[finance.footerText]] takes up to 1200 characters that are printed at the bottom of every document (hint [[finance.footerTextHint]]).",
						"Abschnitt [[finance.documentSection]]: [[finance.logoUpload]] wählt ein Bild (bis 5 MB; es wird automatisch verkleinert, Hinweis [[finance.logoHint]]) und zeigt eine Vorschau; [[finance.logoRemove]] löscht es. Das Feld [[finance.footerText]] nimmt bis zu 1200 Zeichen auf, die unten auf jedem Dokument gedruckt werden (Hinweis [[finance.footerTextHint]]).",
						"Розділ [[finance.documentSection]]: [[finance.logoUpload]] обирає зображення (до 5 МБ; його автоматично зменшують, підказка [[finance.logoHint]]) і показує попередній перегляд; [[finance.logoRemove]] видаляє його. Поле [[finance.footerText]] приймає до 1200 символів, які друкуються внизу кожного документа (підказка [[finance.footerTextHint]]).",
					),
					t3(
						"Section [[finance.templateSection]]: pick one of the ten designs; it is used for every document that has no design of its own (hint [[finance.templateSectionHint]]). The checkbox [[finance.paymentQr]] prints a Girocode (EPC069-12) payment QR next to the bank details, so the customer can pay by scanning it in a banking app (hint [[finance.paymentQrHint]]).",
						"Abschnitt [[finance.templateSection]]: Wählen Sie eines der zehn Layouts; es gilt für jedes Dokument ohne eigenes Layout (Hinweis [[finance.templateSectionHint]]). Das Kästchen [[finance.paymentQr]] druckt einen Girocode (EPC069-12) als Zahlungs-QR neben die Bankdaten, sodass der Kunde ihn in einer Banking-App scannen und bezahlen kann (Hinweis [[finance.paymentQrHint]]).",
						"Розділ [[finance.templateSection]]: оберіть один із десяти макетів; він застосовується до кожного документа без власного макета (підказка [[finance.templateSectionHint]]). Прапорець [[finance.paymentQr]] друкує платіжний QR Girocode (EPC069-12) поруч із банківськими реквізитами, щоб клієнт міг оплатити, відсканувавши його в банківському застосунку (підказка [[finance.paymentQrHint]]).",
					),
				],
			},
			{
				title: t3("Numbering, terms, dunning fees", "Nummern, Fristen, Mahngebühren", "Нумерація, строки, комісії"),
				steps: [
					t3(
						"Section [[finance.invoiceSection]]: [[finance.paymentTerms]] (days from issue to due date; 14 by default), [[finance.reminderIntervalLabel]] (days between automatic reminders; 7 by default) and the number prefixes [[finance.invoicePrefix]], [[finance.quotePrefix]] and [[finance.creditNotePrefixLabel]] (converted to upper case).",
						"Abschnitt [[finance.invoiceSection]]: [[finance.paymentTerms]] (Tage von der Ausstellung bis zur Fälligkeit; standardmäßig 14), [[finance.reminderIntervalLabel]] (Tage zwischen automatischen Erinnerungen; standardmäßig 7) und die Nummernpräfixe [[finance.invoicePrefix]], [[finance.quotePrefix]] und [[finance.creditNotePrefixLabel]] (in Großbuchstaben umgewandelt).",
						"Розділ [[finance.invoiceSection]]: [[finance.paymentTerms]] (днів від виписки до терміну; типово 14), [[finance.reminderIntervalLabel]] (днів між автоматичними нагадуваннями; типово 7) і префікси номерів [[finance.invoicePrefix]], [[finance.quotePrefix]] та [[finance.creditNotePrefixLabel]] (перетворюються на великі літери).",
					),
					t3(
						"Section [[finance.dunningSection]] (explanation [[finance.dunningSettingsHint]]): a fee for each reminder level. The field for level 0 is disabled ([[finance.dunningFeeUnused]]); the fields [[finance.level_1]] to [[finance.level_4]] take the fee, and an empty field means no fee. [[finance.dunningInterestLabel]] takes 0 to 30 % per year and is informational; [[finance.dunningPaymentDaysLabel]] is the new deadline (1 to 60 days) given with each reminder.",
						"Abschnitt [[finance.dunningSection]] (Erklärung [[finance.dunningSettingsHint]]): eine Gebühr je Mahnstufe. Das Feld für Stufe 0 ist gesperrt ([[finance.dunningFeeUnused]]); die Felder [[finance.level_1]] bis [[finance.level_4]] nehmen die Gebühr auf, ein leeres Feld bedeutet keine Gebühr. [[finance.dunningInterestLabel]] nimmt 0 bis 30 % pro Jahr auf und ist informativ; [[finance.dunningPaymentDaysLabel]] ist die neue Frist (1 bis 60 Tage), die mit jeder Erinnerung gesetzt wird.",
						"Розділ [[finance.dunningSection]] (пояснення [[finance.dunningSettingsHint]]): комісія за кожен рівень нагадування. Поле для рівня 0 вимкнене ([[finance.dunningFeeUnused]]); поля [[finance.level_1]]–[[finance.level_4]] приймають комісію, порожнє поле — без комісії. [[finance.dunningInterestLabel]] приймає від 0 до 30 % на рік і є довідковим; [[finance.dunningPaymentDaysLabel]] — новий строк (від 1 до 60 днів), що ставиться з кожним нагадуванням.",
					),
					t3(
						"Press [[finance.save]] once at the bottom; all sections are saved together.",
						"Drücken Sie unten einmal [[finance.save]]; alle Abschnitte werden gemeinsam gespeichert.",
						"Один раз натисніть [[finance.save]] унизу; усі розділи зберігаються разом.",
					),
				],
			},
			{
				title: t3("Audit log", "Änderungsprotokoll", "Журнал змін"),
				steps: [
					t3(
						"Open [[finance.tab_audit]]. It lists financially significant actions: who sent an invoice, marked it as paid, signed a contract, deleted an expense, and also failed sends. Each row has a short summary and, under it, the user and the date with the time. When nothing has happened yet the tab says [[finance.auditEmpty]].",
						"Öffnen Sie [[finance.tab_audit]]. Der Tab listet finanziell relevante Aktionen: wer eine Rechnung gesendet, als bezahlt markiert, einen Vertrag unterzeichnet, eine Ausgabe gelöscht hat, außerdem fehlgeschlagene Versände. Jede Zeile hat eine kurze Zusammenfassung und darunter Benutzer sowie Datum mit Uhrzeit. Ist noch nichts passiert, steht im Tab [[finance.auditEmpty]].",
						"Відкрийте [[finance.tab_audit]]. Вкладка перелічує фінансово значущі дії: хто надіслав рахунок, позначив його оплаченим, підписав договір, видалив витрату, а також невдалі надсилання. Кожен рядок має короткий підсумок, а під ним користувача, дату й час. Якщо нічого ще не було, вкладка каже [[finance.auditEmpty]].",
					),
				],
			},
		],
	},
];
