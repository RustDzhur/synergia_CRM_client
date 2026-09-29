import { t3 } from "../i18n";
import type { DocSection } from "./types";

// Финансы, часть 2: счета, регулярные счета, напоминания об оплате.
export const FINANCE_B: DocSection[] = [
	{
		id: "finance_invoices",
		title: t3("Finance: invoices, recurring, dunning", "Finanzen: Rechnungen, Wiederkehrend, Mahnwesen", "Фінанси: рахунки, регулярні, нагадування"),
		intro: t3(
			"Everything about billing lives in the tabs [[finance.tab_invoices]], [[finance.tab_recurring]] and [[finance.tab_dunning]] of the [[navigation.inventory_management]] section.",
			"Alles rund ums Fakturieren finden Sie in den Tabs [[finance.tab_invoices]], [[finance.tab_recurring]] und [[finance.tab_dunning]] im Bereich [[navigation.inventory_management]].",
			"Усе про виставлення рахунків — на вкладках [[finance.tab_invoices]], [[finance.tab_recurring]] і [[finance.tab_dunning]] розділу [[navigation.inventory_management]].",
		),
		groups: [
			{
				title: t3("Create an invoice", "Rechnung erstellen", "Створення рахунку"),
				steps: [
					t3(
						"Open [[finance.tab_invoices]] and press [[finance.newInvoice]]. Fill in [[finance.customer]] (required), optionally [[finance.supplyDate]], and the lines (see \"Line items\" in the previous section). Save.",
						"Öffnen Sie [[finance.tab_invoices]] und drücken Sie [[finance.newInvoice]]. Füllen Sie [[finance.customer]] (Pflicht), optional [[finance.supplyDate]] und die Positionen aus (siehe „Positionen“ im vorigen Abschnitt). Speichern.",
						"Відкрийте [[finance.tab_invoices]] і натисніть [[finance.newInvoice]]. Заповніть [[finance.customer]] (обов'язково), за бажання [[finance.supplyDate]] та рядки (див. «Позиції» в попередньому розділі). Збережіть.",
					),
					t3(
						"[[finance.supplyDate]] is the date of the delivery or service. On German invoices it is required by §14 UStG; if you leave the field empty, the line is simply not printed on the PDF.",
						"[[finance.supplyDate]] ist das Datum der Lieferung oder Leistung. Auf deutschen Rechnungen ist es nach §14 UStG Pflicht; lassen Sie das Feld leer, wird die Zeile im PDF einfach nicht gedruckt.",
						"[[finance.supplyDate]] — дата поставки або послуги. У німецьких рахунках вона обов'язкова за §14 UStG; якщо залишити поле порожнім, рядок у PDF просто не друкується.",
					),
					t3(
						"The invoice is saved as a draft. It receives a number built from the prefix in the settings (for example RE-2026-1); the number is assigned once and never changes. The due date is today plus the payment terms from [[finance.tab_settings]] (14 days by default).",
						"Die Rechnung wird als Entwurf gespeichert. Sie erhält eine Nummer aus dem Präfix der Einstellungen (zum Beispiel RE-2026-1); die Nummer wird einmalig vergeben und ändert sich nie. Das Fälligkeitsdatum ist heute plus Zahlungsziel aus [[finance.tab_settings]] (standardmäßig 14 Tage).",
						"Рахунок зберігається як чернетка. Він отримує номер із префікса в налаштуваннях (наприклад RE-2026-1); номер призначається один раз і не змінюється. Термін оплати — сьогодні плюс строк оплати з [[finance.tab_settings]] (типово 14 днів).",
					),
					t3(
						"The list card shows the number, the status chip ([[finance.istatus_draft]], [[finance.istatus_sent]], [[finance.istatus_paid]], [[finance.istatus_overdue]], [[finance.istatus_cancelled]]) and a line with the customer, the date and the due date. Extra chips: [[finance.creditNote]] for a credit note, the dunning level ([[finance.level_1]] … [[finance.level_4]]) and the number of reminders already sent.",
						"Die Karte in der Liste zeigt die Nummer, das Status-Chip ([[finance.istatus_draft]], [[finance.istatus_sent]], [[finance.istatus_paid]], [[finance.istatus_overdue]], [[finance.istatus_cancelled]]) und eine Zeile mit Kunde, Datum und Fälligkeit. Zusätzliche Chips: [[finance.creditNote]] für eine Gutschrift, die Mahnstufe ([[finance.level_1]] … [[finance.level_4]]) und die Zahl bereits versendeter Erinnerungen.",
						"Картка у списку показує номер, чип статусу ([[finance.istatus_draft]], [[finance.istatus_sent]], [[finance.istatus_paid]], [[finance.istatus_overdue]], [[finance.istatus_cancelled]]) і рядок із клієнтом, датою та терміном оплати. Додаткові чипи: [[finance.creditNote]] для кредит-ноти, рівень нагадування ([[finance.level_1]] … [[finance.level_4]]) і кількість уже надісланих нагадувань.",
					),
				],
			},
			{
				title: t3("Send, pay, correct", "Senden, bezahlen, korrigieren", "Надсилання, оплата, виправлення"),
				steps: [
					t3(
						"For a draft press [[finance.send]]. The CRM emails the PDF from your first connected mailbox in Web Mails. The recipient is the address you enter, otherwise the contact's address, otherwise the address of the customer company.",
						"Bei einem Entwurf drücken Sie [[finance.send]]. Das CRM versendet das PDF aus Ihrem ersten verbundenen Postfach in Web Mails. Empfänger ist die eingegebene Adresse, sonst die Adresse des Kontakts, sonst die des Kundenunternehmens.",
						"Для чернетки натисніть [[finance.send]]. CRM надсилає PDF з вашої першої підключеної скриньки у Web Mails. Отримувач — введена вами адреса, інакше адреса контакту, інакше адреса компанії клієнта.",
					),
					t3(
						"If no address is known, the window [[finance.sendTitle]] opens with the field [[finance.email]] and the buttons [[finance.cancel]] and [[finance.send]]. If no mailbox is connected at all, an error asks you to connect one in Web Mails.",
						"Ist keine Adresse bekannt, öffnet sich das Fenster [[finance.sendTitle]] mit dem Feld [[finance.email]] und den Schaltflächen [[finance.cancel]] und [[finance.send]]. Ist überhaupt kein Postfach verbunden, bittet eine Fehlermeldung darum, eines in Web Mails zu verbinden.",
						"Якщо адреса невідома, відкривається вікно [[finance.sendTitle]] з полем [[finance.email]] і кнопками [[finance.cancel]] та [[finance.send]]. Якщо скринька взагалі не підключена, помилка пропонує підключити її у Web Mails.",
					),
					t3(
						"The status becomes [[finance.istatus_sent]] only after the e-mail has really been sent. If sending fails, the invoice stays a draft and a failed attempt is written into the audit log. A successful send fires the automation event \"invoice sent\".",
						"Der Status wird erst [[finance.istatus_sent]], nachdem die E-Mail wirklich versendet wurde. Schlägt der Versand fehl, bleibt die Rechnung ein Entwurf und ein Fehlversuch wird im Änderungsprotokoll vermerkt. Ein erfolgreicher Versand löst das Ereignis „Rechnung gesendet“ aus.",
						"Статус стає [[finance.istatus_sent]] лише після того, як лист справді надіслано. Якщо надсилання не вдалося, рахунок лишається чернеткою, а невдала спроба записується в журнал змін. Успішне надсилання запускає подію автоматизації «рахунок надіслано».",
					),
					t3(
						"When the customer has paid, press [[finance.markPaid]] on a sent or overdue invoice. The status becomes [[finance.istatus_paid]], the card shows the payment date, and the automation event \"invoice paid\" is fired. Revenue reports count an invoice by this payment date.",
						"Hat der Kunde bezahlt, drücken Sie bei einer versendeten oder überfälligen Rechnung [[finance.markPaid]]. Der Status wird [[finance.istatus_paid]], die Karte zeigt das Zahlungsdatum und das Ereignis „Rechnung bezahlt“ wird ausgelöst. Umsatzberichte zählen eine Rechnung nach diesem Zahlungsdatum.",
						"Коли клієнт заплатив, натисніть [[finance.markPaid]] на надісланому або простроченому рахунку. Статус стає [[finance.istatus_paid]], картка показує дату оплати і запускається подія «рахунок оплачено». Звіти про дохід рахують рахунок за цією датою оплати.",
					),
					t3(
						"To correct a sent, paid or overdue invoice, press [[finance.issueCreditNote]]. A window opens with the field [[finance.notes]] and the buttons to save or cancel. The CRM creates a separate credit note: all lines with a negative price, its own number (prefix from the settings, \"GS\" by default) and the status sent at once. The original invoice stays unchanged; the automation event \"credit note created\" is fired.",
						"Um eine versendete, bezahlte oder überfällige Rechnung zu korrigieren, drücken Sie [[finance.issueCreditNote]]. Es öffnet sich ein Fenster mit dem Feld [[finance.notes]] und den Schaltflächen zum Speichern oder Abbrechen. Das CRM erstellt eine eigene Gutschrift: alle Positionen mit negativem Preis, eigene Nummer (Präfix aus den Einstellungen, standardmäßig „GS“) und sofort im Status versendet. Die Originalrechnung bleibt unverändert; das Ereignis „Gutschrift erstellt“ wird ausgelöst.",
						"Щоб виправити надісланий, оплачений чи прострочений рахунок, натисніть [[finance.issueCreditNote]]. Відкриється вікно з полем [[finance.notes]] і кнопками збереження та скасування. CRM створює окремий документ — кредит-ноту: усі рядки з від'ємною ціною, власний номер (префікс із налаштувань, типово «GS») і одразу статус «надіслано». Оригінальний рахунок не змінюється; запускається подія «кредит-ноту створено».",
					),
					t3(
						"[[finance.duplicate]] (invoices only) creates a new draft with the same customer and lines; the message [[finance.invoiceDuplicated]] confirms it. [[finance.downloadPdf]] downloads the PDF and [[finance.template]] changes the design of this invoice.",
						"[[finance.duplicate]] (nur bei Rechnungen) erstellt einen neuen Entwurf mit demselben Kunden und denselben Positionen; die Meldung [[finance.invoiceDuplicated]] bestätigt das. [[finance.downloadPdf]] lädt das PDF herunter und [[finance.template]] ändert das Layout dieser Rechnung.",
						"[[finance.duplicate]] (лише для рахунків) створює нову чернетку з тим самим клієнтом і рядками; повідомлення [[finance.invoiceDuplicated]] це підтверджує. [[finance.downloadPdf]] завантажує PDF, а [[finance.template]] змінює макет цього рахунку.",
					),
					t3(
						"If reminders have been sent for an invoice, the card shows the block [[finance.dunningHistory]] with the level, the date and the fee of each reminder.",
						"Wurden für eine Rechnung Erinnerungen versendet, zeigt die Karte den Block [[finance.dunningHistory]] mit Stufe, Datum und Gebühr jeder Erinnerung.",
						"Якщо за рахунком надсилали нагадування, на картці є блок [[finance.dunningHistory]] з рівнем, датою та комісією кожного нагадування.",
					),
					t3(
						"Overdue status is set by a daily background job (about 06:00 UTC): it moves sent invoices with a past due date to [[finance.istatus_overdue]] and fires the event \"invoice overdue\". So the change appears once a day, not the minute the due date passes.",
						"Der Status „überfällig“ wird von einem täglichen Hintergrundjob gesetzt (etwa 06:00 UTC): Er setzt versendete Rechnungen mit abgelaufener Frist auf [[finance.istatus_overdue]] und löst das Ereignis „Rechnung überfällig“ aus. Die Änderung erscheint also einmal am Tag, nicht in der Minute des Fristablaufs.",
						"Статус «прострочено» ставить щоденне фонове завдання (близько 06:00 UTC): воно переводить надіслані рахунки зі спливлим терміном у [[finance.istatus_overdue]] і запускає подію «рахунок прострочено». Тож зміна з'являється раз на добу, а не в хвилину, коли термін минув.",
					),
				],
			},
			{
				title: t3("Recurring invoices", "Wiederkehrende Rechnungen", "Регулярні рахунки"),
				steps: [
					t3(
						"Open [[finance.tab_recurring]] and press [[finance.newRecurringInvoice]]. The form has [[finance.customer]], the lines, [[finance.recurringInterval]] (monthly or yearly), [[finance.recurringDayOfMonth]] (1 to 28), [[finance.recurringNextRun]] (the date of the first invoice) and the checkbox [[finance.recurringAutoSend]].",
						"Öffnen Sie [[finance.tab_recurring]] und drücken Sie [[finance.newRecurringInvoice]]. Das Formular hat [[finance.customer]], die Positionen, [[finance.recurringInterval]] (monatlich oder jährlich), [[finance.recurringDayOfMonth]] (1 bis 28), [[finance.recurringNextRun]] (Datum der ersten Rechnung) und das Kästchen [[finance.recurringAutoSend]].",
						"Відкрийте [[finance.tab_recurring]] і натисніть [[finance.newRecurringInvoice]]. У формі є [[finance.customer]], рядки, [[finance.recurringInterval]] (щомісяця чи щороку), [[finance.recurringDayOfMonth]] (від 1 до 28), [[finance.recurringNextRun]] (дата першого рахунку) і прапорець [[finance.recurringAutoSend]].",
					),
					t3(
						"Each card shows the chip [[finance.recurringActive]] or [[finance.recurringPaused]], the interval with the next run date, and whether it is sent automatically. The button [[finance.recurringPause]] stops creating invoices; [[finance.recurringResume]] starts again.",
						"Jede Karte zeigt das Chip [[finance.recurringActive]] oder [[finance.recurringPaused]], das Intervall mit dem nächsten Ausführungsdatum und ob automatisch gesendet wird. [[finance.recurringPause]] stoppt die Erstellung von Rechnungen; [[finance.recurringResume]] setzt sie fort.",
						"Кожна картка показує чип [[finance.recurringActive]] або [[finance.recurringPaused]], інтервал із датою наступного запуску та чи надсилається автоматично. Кнопка [[finance.recurringPause]] зупиняє створення рахунків; [[finance.recurringResume]] відновлює його.",
					),
					t3(
						"[[finance.delete]] removes the template after a confirmation; invoices that were already created from it stay untouched.",
						"[[finance.delete]] entfernt die Vorlage nach einer Bestätigung; bereits daraus erzeugte Rechnungen bleiben unverändert.",
						"[[finance.delete]] видаляє шаблон після підтвердження; рахунки, уже створені з нього, не змінюються.",
					),
					t3(
						"The same daily background job creates the invoices: on the run date it makes an invoice from the template (a draft, or already sent when [[finance.recurringAutoSend]] is on) and moves the next run date forward by one interval.",
						"Derselbe tägliche Hintergrundjob erstellt die Rechnungen: Am Ausführungsdatum erzeugt er aus der Vorlage eine Rechnung (als Entwurf oder, bei aktivem [[finance.recurringAutoSend]], sofort versendet) und schiebt das nächste Datum um ein Intervall weiter.",
						"Те саме щоденне фонове завдання створює рахунки: у день запуску воно робить рахунок із шаблону (чернетку або одразу надісланий, якщо ввімкнено [[finance.recurringAutoSend]]) і зсуває наступну дату на один інтервал.",
					),
				],
			},
			{
				title: t3("Dunning (payment reminders)", "Mahnwesen (Zahlungserinnerungen)", "Нагадування про оплату"),
				steps: [
					t3(
						"Open [[finance.tab_dunning]]. The heading is [[finance.dunningTitle]] with an explanation under it. Three tiles sum up the state: [[finance.dunningSummaryDue]], [[finance.dunningSummaryOpen]] and [[finance.dunningSummaryFees]].",
						"Öffnen Sie [[finance.tab_dunning]]. Die Überschrift ist [[finance.dunningTitle]] mit einer Erklärung darunter. Drei Kacheln fassen den Stand zusammen: [[finance.dunningSummaryDue]], [[finance.dunningSummaryOpen]] und [[finance.dunningSummaryFees]].",
						"Відкрийте [[finance.tab_dunning]]. Заголовок — [[finance.dunningTitle]] з поясненням під ним. Три плитки підсумовують стан: [[finance.dunningSummaryDue]], [[finance.dunningSummaryOpen]] і [[finance.dunningSummaryFees]].",
					),
					t3(
						"The table lists invoices that are overdue (or sent with a past due date), the longest overdue first. Columns: [[finance.dunningColInvoice]], [[finance.customer]], [[finance.dueDate]], [[finance.dunningColDays]], [[finance.dunningColLevel]] (levels 1 to 4, level 4 in red; [[finance.dunningNone]] when no reminder has been sent yet), [[finance.dunningColFee]], [[finance.dunningColOpen]], [[finance.dunningColInterest]] and [[finance.dunningColAction]]. When nothing is overdue the tab says [[finance.dunningEmpty]].",
						"Die Tabelle listet überfällige Rechnungen (oder versendete mit abgelaufener Frist), die am längsten überfällige zuerst. Spalten: [[finance.dunningColInvoice]], [[finance.customer]], [[finance.dueDate]], [[finance.dunningColDays]], [[finance.dunningColLevel]] (Stufen 1 bis 4, Stufe 4 in Rot; [[finance.dunningNone]], solange noch keine Erinnerung gesendet wurde), [[finance.dunningColFee]], [[finance.dunningColOpen]], [[finance.dunningColInterest]] und [[finance.dunningColAction]]. Ist nichts überfällig, steht im Tab [[finance.dunningEmpty]].",
						"Таблиця перелічує прострочені рахунки (або надіслані зі спливлим терміном), найдовше прострочений — першим. Колонки: [[finance.dunningColInvoice]], [[finance.customer]], [[finance.dueDate]], [[finance.dunningColDays]], [[finance.dunningColLevel]] (рівні від 1 до 4, рівень 4 червоним; [[finance.dunningNone]], доки нагадувань не було), [[finance.dunningColFee]], [[finance.dunningColOpen]], [[finance.dunningColInterest]] і [[finance.dunningColAction]]. Якщо прострочених немає, вкладка показує [[finance.dunningEmpty]].",
					),
					t3(
						"[[finance.dunningColInterest]] is informational only. It stays empty until you enter an annual rate in [[finance.tab_settings]]; then it is (amount + fees) × rate × days overdue / 365.",
						"[[finance.dunningColInterest]] ist nur informativ. Die Spalte bleibt leer, bis Sie in [[finance.tab_settings]] einen Jahreszinssatz eintragen; dann gilt (Betrag + Gebühren) × Satz × Tage überfällig / 365.",
						"[[finance.dunningColInterest]] — лише довідково. Колонка порожня, доки ви не вкажете річну ставку у [[finance.tab_settings]]; тоді це (сума + комісії) × ставка × днів прострочення / 365.",
					),
					t3(
						"Press [[finance.dunningSend]] in a row (while it works the button says [[finance.dunningSending]]). The CRM raises the dunning level by one, adds the fee set for that level, gives a new payment deadline and fires the automation event \"invoice reminder\".",
						"Drücken Sie [[finance.dunningSend]] in einer Zeile (währenddessen steht auf der Schaltfläche [[finance.dunningSending]]). Das CRM erhöht die Mahnstufe um eins, addiert die für diese Stufe eingestellte Gebühr, setzt eine neue Zahlungsfrist und löst das Ereignis „Zahlungserinnerung“ aus.",
						"Натисніть [[finance.dunningSend]] у рядку (поки триває дія, кнопка показує [[finance.dunningSending]]). CRM підвищує рівень нагадування на один, додає комісію, задану для цього рівня, дає новий термін оплати і запускає подію автоматизації «нагадування про оплату».",
					),
					t3(
						"Important: this button does not send a letter to the customer. What happens next is up to your automation rules for the event \"invoice reminder\": they can notify your team or e-mail the firm owner. The action \"send an email\" to the client cannot find the customer's address for invoice events (it takes the address only from deal or contact data), so send the reminder letter yourself, for example from Web Mails, after pressing the button.",
						"Wichtig: Diese Schaltfläche schickt keinen Brief an den Kunden. Was danach passiert, bestimmen Ihre Automatisierungsregeln für das Ereignis „Zahlungserinnerung“: Sie können Ihr Team benachrichtigen oder dem Firmeninhaber eine E-Mail senden. Die Aktion „E-Mail senden“ an den Kunden findet bei Rechnungsereignissen die Adresse des Kunden nicht (sie nimmt Adressen nur aus Deal- oder Kontaktdaten); versenden Sie das Erinnerungsschreiben daher nach dem Klick selbst, zum Beispiel aus Web Mails.",
						"Важливо: ця кнопка не надсилає лист клієнту. Що буде далі, визначають ваші правила автоматизації для події «нагадування про оплату»: вони можуть сповістити команду або надіслати лист власнику фірми. Дія «надіслати e-mail» клієнту для подій рахунків не знаходить адресу клієнта (вона бере адресу лише з даних угоди чи контакту), тому лист-нагадування надішліть самі, наприклад із Web Mails, після натискання кнопки.",
					),
					t3(
						"In place of a button a row may show a calm notice: [[finance.dunningNoticePaid]], [[finance.dunningNoticeCancelled]], [[finance.dunningNoticeNoDueDate]], [[finance.dunningNoticeMaxLevel]], [[finance.dunningNoticeOnlyInvoices]] or [[finance.dunningNoticeNotFound]]; if the request itself fails the message is [[finance.dunningRemindFailed]].",
						"Anstelle einer Schaltfläche kann eine Zeile einen ruhigen Hinweis zeigen: [[finance.dunningNoticePaid]], [[finance.dunningNoticeCancelled]], [[finance.dunningNoticeNoDueDate]], [[finance.dunningNoticeMaxLevel]], [[finance.dunningNoticeOnlyInvoices]] oder [[finance.dunningNoticeNotFound]]; schlägt die Anfrage selbst fehl, lautet die Meldung [[finance.dunningRemindFailed]].",
						"Замість кнопки рядок може показати спокійне повідомлення: [[finance.dunningNoticePaid]], [[finance.dunningNoticeCancelled]], [[finance.dunningNoticeNoDueDate]], [[finance.dunningNoticeMaxLevel]], [[finance.dunningNoticeOnlyInvoices]] чи [[finance.dunningNoticeNotFound]]; якщо збігає сам запит, повідомлення — [[finance.dunningRemindFailed]].",
					),
					t3(
						"Automatic reminders: the daily job raises the level by itself every N days (the interval [[finance.reminderIntervalLabel]] from the settings, 7 days by default) up to level 4 and fires the same event. Stages above level 4 (legal steps) are always decided by a person.",
						"Automatische Erinnerungen: Der tägliche Job erhöht die Stufe von selbst alle N Tage (das Intervall [[finance.reminderIntervalLabel]] aus den Einstellungen, standardmäßig 7 Tage) bis Stufe 4 und löst dasselbe Ereignis aus. Stufen über 4 (rechtliche Schritte) entscheidet immer ein Mensch.",
						"Автоматичні нагадування: щоденне завдання саме підвищує рівень кожні N днів (інтервал [[finance.reminderIntervalLabel]] з налаштувань, типово 7 днів) до рівня 4 і запускає ту саму подію. Етапи вище рівня 4 (юридичні кроки) завжди вирішує людина.",
					),
				],
			},
		],
	},
];
