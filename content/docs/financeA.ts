import { t3 } from "../i18n";
import type { DocSection } from "./types";

// Финансы, часть 1: устройство раздела, обзор, предложения, заказы, договоры, общий редактор позиций и кнопка «Дизайн».
export const FINANCE_A: DocSection[] = [
	{
		id: "finance",
		title: t3("Finance: quotes, orders, contracts", "Finanzen: Angebote, Aufträge, Verträge", "Фінанси: пропозиції, замовлення, договори"),
		intro: t3(
			"The [[navigation.inventory_management]] section is the accounting side of the CRM: quotes, orders, contracts, invoices, expenses, assets, bank and cash, products, tax reports and settings. It is available in the Professional plan. In a plan without it, a direct link leads to the plans page with a note. Roles: owner, admin and manager can open it; employee and viewer cannot. This part describes the structure, the overview, quotes, orders and contracts; invoices, money and reports follow in the next sections.",
			"Der Bereich [[navigation.inventory_management]] ist die Buchhaltungsseite des CRM: Angebote, Aufträge, Verträge, Rechnungen, Ausgaben, Anlagen, Bank und Kasse, Produkte, Steuerberichte und Einstellungen. Er ist im Tarif Professional enthalten. In einem Tarif ohne diesen Bereich führt ein direkter Link zur Tarifseite mit einem Hinweis. Rollen: Inhaber, Admin und Manager können ihn öffnen; Mitarbeiter und Betrachter nicht. Dieser Teil beschreibt Aufbau, Übersicht, Angebote, Aufträge und Verträge; Rechnungen, Geld und Berichte folgen in den nächsten Abschnitten.",
			"Розділ [[navigation.inventory_management]] — це бухгалтерська частина CRM: пропозиції, замовлення, договори, рахунки, витрати, активи, банк і каса, товари, податкові звіти та налаштування. Він входить у тариф Professional. У тарифі без цього розділу пряме посилання веде на сторінку тарифів із поясненням. Ролі: власник, адмін і менеджер можуть його відкрити; співробітник і глядач — ні. Тут описано будову, огляд, пропозиції, замовлення й договори; рахунки, гроші та звіти — у наступних розділах.",
		),
		groups: [
			{
				title: t3("How the section is laid out", "Aufbau des Bereichs", "Як улаштовано розділ"),
				steps: [
					t3(
						"Open [[navigation.inventory_management]] in the left menu. The page title is [[finance.title]]. On a wide screen the tabs stand in a column on the left; on a phone or tablet they become a scrollable row of pills above the content.",
						"Öffnen Sie [[navigation.inventory_management]] im linken Menü. Der Seitentitel ist [[finance.title]]. Auf einem breiten Bildschirm stehen die Tabs als Spalte links; auf Handy und Tablet werden sie zu einer scrollbaren Pillen-Reihe über dem Inhalt.",
						"Відкрийте [[navigation.inventory_management]] у лівому меню. Заголовок сторінки — [[finance.title]]. На широкому екрані вкладки стоять колонкою ліворуч; на телефоні й планшеті вони перетворюються на рядок-«пігулки» над вмістом, який гортається.",
					),
					t3(
						"The order of the tabs: [[finance.tab_overview]]; group [[finance.nav_group_orders]] ([[finance.tab_quotes]], [[finance.tab_orders]], [[finance.tab_contracts]]); group [[finance.nav_group_invoices]] ([[finance.tab_invoices]], [[finance.tab_recurring]], [[finance.tab_dunning]]); [[finance.tab_expenses]]; [[finance.tab_assets]]; [[finance.tab_bank]]; [[finance.tab_products]]; group [[finance.nav_group_taxes]] ([[finance.tab_vat]], [[finance.tab_eur]]); group [[finance.nav_group_reports]] ([[finance.tab_bwa]], [[finance.tab_susa]]); [[finance.tab_settings]]; [[finance.tab_audit]].",
						"Die Reihenfolge der Tabs: [[finance.tab_overview]]; Gruppe [[finance.nav_group_orders]] ([[finance.tab_quotes]], [[finance.tab_orders]], [[finance.tab_contracts]]); Gruppe [[finance.nav_group_invoices]] ([[finance.tab_invoices]], [[finance.tab_recurring]], [[finance.tab_dunning]]); [[finance.tab_expenses]]; [[finance.tab_assets]]; [[finance.tab_bank]]; [[finance.tab_products]]; Gruppe [[finance.nav_group_taxes]] ([[finance.tab_vat]], [[finance.tab_eur]]); Gruppe [[finance.nav_group_reports]] ([[finance.tab_bwa]], [[finance.tab_susa]]); [[finance.tab_settings]]; [[finance.tab_audit]].",
						"Порядок вкладок: [[finance.tab_overview]]; група [[finance.nav_group_orders]] ([[finance.tab_quotes]], [[finance.tab_orders]], [[finance.tab_contracts]]); група [[finance.nav_group_invoices]] ([[finance.tab_invoices]], [[finance.tab_recurring]], [[finance.tab_dunning]]); [[finance.tab_expenses]]; [[finance.tab_assets]]; [[finance.tab_bank]]; [[finance.tab_products]]; група [[finance.nav_group_taxes]] ([[finance.tab_vat]], [[finance.tab_eur]]); група [[finance.nav_group_reports]] ([[finance.tab_bwa]], [[finance.tab_susa]]); [[finance.tab_settings]]; [[finance.tab_audit]].",
					),
					t3(
						"The group names are only headings: they cannot be clicked. Click a tab to switch; the content on the right changes without reloading the page.",
						"Die Gruppennamen sind nur Überschriften und nicht anklickbar. Ein Klick auf einen Tab wechselt den Inhalt rechts, ohne die Seite neu zu laden.",
						"Назви груп — лише заголовки, на них не можна клацнути. Клік по вкладці перемикає вміст праворуч без перезавантаження сторінки.",
					),
					t3(
						"Links with a tab in the address (for example from a notification, from an automation rule or from a deal card) open the right tab straight away. On a deal card the button \"Create Quote\" opens [[finance.tab_quotes]] with the form already filled in and linked to the deal ([[finance.linkedToDeal]]).",
						"Links mit einem Tab in der Adresse (zum Beispiel aus einer Benachrichtigung, einer Automatisierungsregel oder einer Deal-Karte) öffnen sofort den richtigen Tab. Auf einer Deal-Karte öffnet die Schaltfläche „Angebot erstellen“ den Tab [[finance.tab_quotes]] mit vorausgefülltem, mit dem Deal verknüpftem Formular ([[finance.linkedToDeal]]).",
						"Посилання з вкладкою в адресі (наприклад зі сповіщення, правила автоматизації чи картки угоди) одразу відкривають потрібну вкладку. На картці угоди кнопка «Створити пропозицію» відкриває [[finance.tab_quotes]] із заповненою формою, пов'язаною з угодою ([[finance.linkedToDeal]]).",
					),
				],
			},
			{
				title: t3("Overview", "Übersicht", "Огляд"),
				steps: [
					t3(
						"[[finance.tab_overview]] shows five tiles. [[finance.kpiRevenue]] is the sum of all paid invoices (gross, for all time). [[finance.kpiOutstanding]] is the sum of invoices that are sent or overdue and not yet paid. [[finance.kpiOverdue]] is the part whose due date has passed; the tile turns red when it is above zero. [[finance.kpiExpenses]] is the expenses of the last six months. [[finance.kpiProfit]] is revenue minus expenses; green when it is zero or more, red when negative.",
						"[[finance.tab_overview]] zeigt fünf Kacheln. [[finance.kpiRevenue]] ist die Summe aller bezahlten Rechnungen (brutto, für die gesamte Zeit). [[finance.kpiOutstanding]] ist die Summe der versendeten oder überfälligen, noch nicht bezahlten Rechnungen. [[finance.kpiOverdue]] ist der Teil mit abgelaufener Frist; die Kachel wird rot, sobald der Wert über null liegt. [[finance.kpiExpenses]] sind die Ausgaben der letzten sechs Monate. [[finance.kpiProfit]] ist Umsatz minus Ausgaben; grün ab null, rot bei einem Minus.",
						"[[finance.tab_overview]] показує п'ять плиток. [[finance.kpiRevenue]] — сума всіх оплачених рахунків (брутто, за весь час). [[finance.kpiOutstanding]] — сума надісланих або прострочених рахунків, які ще не оплачені. [[finance.kpiOverdue]] — частина зі спливлим терміном; плитка червоніє, коли значення більше нуля. [[finance.kpiExpenses]] — витрати за останні шість місяців. [[finance.kpiProfit]] — дохід мінус витрати; зелений від нуля, червоний при мінусі.",
					),
					t3(
						"Note: revenue counts all paid invoices without a time limit, while expenses cover only the last six months, so the profit tile is a rough figure. For an exact period use [[finance.tab_eur]] or [[finance.tab_bwa]].",
						"Hinweis: Der Umsatz zählt alle bezahlten Rechnungen ohne Zeitgrenze, die Ausgaben nur die letzten sechs Monate; die Gewinn-Kachel ist daher ein grober Wert. Für einen genauen Zeitraum nutzen Sie [[finance.tab_eur]] oder [[finance.tab_bwa]].",
						"Зверніть увагу: дохід рахує всі оплачені рахунки без обмеження за часом, а витрати — лише за останні шість місяців, тож плитка прибутку — орієнтовна. Для точного періоду користуйтеся [[finance.tab_eur]] або [[finance.tab_bwa]].",
					),
					t3(
						"The chart [[finance.chartTitle]] shows six months with two bars per month: revenue (by the payment date of invoices) and expenses (by the expense date). Under it, [[finance.ordersFunnel]] counts orders by status, and [[finance.lowStockTitle]] lists goods whose stock is at or below the reorder level; when everything is fine it says [[finance.noLowStock]].",
						"Das Diagramm [[finance.chartTitle]] zeigt sechs Monate mit zwei Balken pro Monat: Umsatz (nach Zahlungsdatum der Rechnungen) und Ausgaben (nach Ausgabendatum). Darunter zählt [[finance.ordersFunnel]] die Aufträge nach Status, und [[finance.lowStockTitle]] listet Waren, deren Bestand auf oder unter der Meldemenge liegt; ist alles in Ordnung, steht dort [[finance.noLowStock]].",
						"Діаграма [[finance.chartTitle]] показує шість місяців із двома стовпчиками на місяць: дохід (за датою оплати рахунків) і витрати (за датою витрати). Нижче [[finance.ordersFunnel]] рахує замовлення за статусами, а [[finance.lowStockTitle]] перелічує товари із залишком не вище порогу дозамовлення; коли все гаразд, написано [[finance.noLowStock]].",
					),
				],
			},
			{
				title: t3("Line items in quotes, orders, invoices", "Positionen in Angeboten, Aufträgen, Rechnungen", "Позиції в пропозиціях, замовленнях, рахунках"),
				steps: [
					t3(
						"Every document form (quote, order, invoice, recurring invoice) has the same table of lines. Columns: [[finance.itemDescription]], [[finance.itemProduct]] (a list of your products; [[finance.itemCustom]] means a free line without a product), [[finance.itemQty]], [[finance.itemPrice]] and [[finance.itemTax]] in percent.",
						"Jedes Dokumentformular (Angebot, Auftrag, Rechnung, wiederkehrende Rechnung) hat dieselbe Positionstabelle. Spalten: [[finance.itemDescription]], [[finance.itemProduct]] (Liste Ihrer Produkte; [[finance.itemCustom]] bedeutet eine freie Zeile ohne Produkt), [[finance.itemQty]], [[finance.itemPrice]] und [[finance.itemTax]] in Prozent.",
						"Кожна форма документа (пропозиція, замовлення, рахунок, регулярний рахунок) має однакову таблицю рядків. Колонки: [[finance.itemDescription]], [[finance.itemProduct]] (список ваших товарів; [[finance.itemCustom]] — вільний рядок без товару), [[finance.itemQty]], [[finance.itemPrice]] і [[finance.itemTax]] у відсотках.",
					),
					t3(
						"When you pick a product in the list, the description, the price and the tax rate are filled in from it; you can still change them in this line. Archived products are not offered.",
						"Wählen Sie ein Produkt in der Liste, werden Beschreibung, Preis und Steuersatz daraus übernommen; Sie können sie in dieser Zeile weiterhin ändern. Archivierte Produkte werden nicht angeboten.",
						"Коли ви обираєте товар у списку, опис, ціна й ставка податку підставляються з нього; у цьому рядку їх усе одно можна змінити. Архівні товари не пропонуються.",
					),
					t3(
						"[[finance.itemAdd]] adds a new empty line; the trash icon ([[finance.itemRemove]]) removes the line. Under the table the form shows [[finance.net]], [[finance.taxTotal]] and [[finance.gross]] and recalculates them as you type.",
						"[[finance.itemAdd]] fügt eine neue leere Zeile hinzu; das Papierkorb-Symbol ([[finance.itemRemove]]) entfernt die Zeile. Unter der Tabelle zeigt das Formular [[finance.net]], [[finance.taxTotal]] und [[finance.gross]] und rechnet beim Tippen mit.",
						"[[finance.itemAdd]] додає новий порожній рядок; іконка кошика ([[finance.itemRemove]]) видаляє рядок. Під таблицею форма показує [[finance.net]], [[finance.taxTotal]] і [[finance.gross]] і перераховує їх під час введення.",
					),
					t3(
						"The default tax rate of a new line is the standard rate of the country chosen in [[finance.tab_settings]]; it is 0 for a small business exemption or when no country is set. Lines with an empty description are dropped on save.",
						"Der Standard-Steuersatz einer neuen Zeile ist der Regelsatz des in [[finance.tab_settings]] gewählten Landes; bei Kleinunternehmerregelung oder ohne Land ist er 0. Zeilen ohne Beschreibung werden beim Speichern verworfen.",
						"Типова ставка податку нового рядка — стандартна ставка країни, обраної у [[finance.tab_settings]]; для звільнення малого підприємця або без країни вона дорівнює 0. Рядки з порожнім описом під час збереження відкидаються.",
					),
					t3(
						"If you press save without a customer, the form shows [[finance.customerRequired]]; without a single line it shows [[finance.itemsRequired]]. Nothing is saved until both are fixed.",
						"Speichern Sie ohne Kunden, zeigt das Formular [[finance.customerRequired]]; ohne eine einzige Zeile [[finance.itemsRequired]]. Gespeichert wird erst, wenn beides behoben ist.",
						"Якщо натиснути збереження без клієнта, форма покаже [[finance.customerRequired]]; без жодного рядка — [[finance.itemsRequired]]. Доки обидва пункти не виправлені, нічого не зберігається.",
					),
				],
			},
			{
				title: t3("Quotes", "Angebote", "Пропозиції"),
				steps: [
					t3(
						"Open [[finance.tab_quotes]] and press [[finance.newQuote]]. Enter [[finance.customer]] (required) and the lines, then save. A draft with an automatic number appears in the list. The validity date ([[finance.validUntil]]) is set to today plus 30 days.",
						"Öffnen Sie [[finance.tab_quotes]] und drücken Sie [[finance.newQuote]]. Geben Sie [[finance.customer]] (Pflicht) und die Positionen ein und speichern Sie. Ein Entwurf mit automatischer Nummer erscheint in der Liste. Das Gültigkeitsdatum ([[finance.validUntil]]) ist auf heute plus 30 Tage gesetzt.",
						"Відкрийте [[finance.tab_quotes]] і натисніть [[finance.newQuote]]. Вкажіть [[finance.customer]] (обов'язково) та рядки й збережіть. У списку з'явиться чернетка з автоматичним номером. Дата дії ([[finance.validUntil]]) ставиться на сьогодні плюс 30 днів.",
					),
					t3(
						"Each card shows the number, a status chip ([[finance.qstatus_draft]], [[finance.qstatus_sent]], [[finance.qstatus_accepted]], [[finance.qstatus_declined]], [[finance.qstatus_expired]]), the customer with the validity date and the total. The status [[finance.qstatus_expired]] is never set automatically; it exists for manual bookkeeping only.",
						"Jede Karte zeigt die Nummer, ein Status-Chip ([[finance.qstatus_draft]], [[finance.qstatus_sent]], [[finance.qstatus_accepted]], [[finance.qstatus_declined]], [[finance.qstatus_expired]]), den Kunden mit Gültigkeitsdatum und die Summe. Der Status [[finance.qstatus_expired]] wird nie automatisch gesetzt.",
						"Кожна картка показує номер, чип статусу ([[finance.qstatus_draft]], [[finance.qstatus_sent]], [[finance.qstatus_accepted]], [[finance.qstatus_declined]], [[finance.qstatus_expired]]), клієнта з датою дії та суму. Статус [[finance.qstatus_expired]] ніколи не ставиться автоматично.",
					),
					t3(
						"For a draft press [[finance.send]]. The CRM emails the quote as a PDF from your first connected mailbox in Web Mails. If no mailbox is connected, a message asks you to connect one; unlike invoices there is no window for typing an address, so the recipient comes from the contact or the customer company. After a successful send the status becomes [[finance.qstatus_sent]] and the automation event \"quote sent\" is fired.",
						"Bei einem Entwurf drücken Sie [[finance.send]]. Das CRM versendet das Angebot als PDF aus Ihrem ersten verbundenen Postfach in Web Mails. Ist kein Postfach verbunden, bittet eine Meldung um die Verbindung; anders als bei Rechnungen gibt es kein Fenster zur Adresseingabe, der Empfänger stammt aus dem Kontakt oder dem Kundenunternehmen. Nach erfolgreichem Versand wird der Status [[finance.qstatus_sent]] und das Automatisierungs-Ereignis „Angebot gesendet“ ausgelöst.",
						"Для чернетки натисніть [[finance.send]]. CRM надсилає пропозицію PDF з вашої першої підключеної скриньки у Web Mails. Якщо скринька не підключена, повідомлення пропонує її підключити; на відміну від рахунків, вікна для введення адреси немає — отримувач береться з контакту чи компанії клієнта. Після успішного надсилання статус стає [[finance.qstatus_sent]] і спрацьовує подія автоматизації «пропозицію надіслано».",
					),
					t3(
						"For a sent quote press [[finance.markAccepted]] or [[finance.markDeclined]] once the customer has answered. For an accepted quote without an order the button [[finance.makeOrder]] appears: it creates an order with the same lines (a message [[finance.orderCreated]] confirms it); afterwards the card shows the link [[finance.viewOrder]] instead.",
						"Bei einem versendeten Angebot drücken Sie [[finance.markAccepted]] oder [[finance.markDeclined]], sobald der Kunde geantwortet hat. Bei einem angenommenen Angebot ohne Auftrag erscheint die Schaltfläche [[finance.makeOrder]]: Sie erstellt einen Auftrag mit denselben Positionen (die Meldung [[finance.orderCreated]] bestätigt es); danach zeigt die Karte stattdessen den Link [[finance.viewOrder]].",
						"Для надісланої пропозиції натисніть [[finance.markAccepted]] або [[finance.markDeclined]], коли клієнт відповів. Для прийнятої пропозиції без замовлення з'являється кнопка [[finance.makeOrder]]: вона створює замовлення з тими самими рядками (повідомлення [[finance.orderCreated]] підтверджує це); після цього на картці замість неї стоїть посилання [[finance.viewOrder]].",
					),
					t3(
						"In every status the card has [[finance.downloadPdf]] and [[finance.template]] (see \"The Design button\" below). If a quote was saved again after changes, a chip with the version number and [[finance.history]] appears; click it to unfold the list of earlier versions.",
						"In jedem Status hat die Karte [[finance.downloadPdf]] und [[finance.template]] (siehe „Die Schaltfläche Design“ unten). Wurde ein Angebot nach Änderungen erneut gespeichert, erscheint ein Chip mit Versionsnummer und [[finance.history]]; ein Klick klappt die Liste früherer Versionen auf.",
						"У кожному статусі на картці є [[finance.downloadPdf]] і [[finance.template]] (див. «Кнопка Дизайн» нижче). Якщо пропозицію зберегли повторно після змін, з'являється чип із номером версії та [[finance.history]]; клік розгортає список попередніх версій.",
					),
				],
			},
			{
				title: t3("Orders", "Aufträge", "Замовлення"),
				steps: [
					t3(
						"Open [[finance.tab_orders]] and press [[finance.newOrder]]. Fill in [[finance.customer]] (required), optionally [[finance.responsible]], and the lines; save. You can also get an order from an accepted quote with [[finance.makeOrder]].",
						"Öffnen Sie [[finance.tab_orders]] und drücken Sie [[finance.newOrder]]. Füllen Sie [[finance.customer]] (Pflicht), optional [[finance.responsible]] und die Positionen aus; speichern Sie. Einen Auftrag erhalten Sie auch aus einem angenommenen Angebot mit [[finance.makeOrder]].",
						"Відкрийте [[finance.tab_orders]] і натисніть [[finance.newOrder]]. Заповніть [[finance.customer]] (обов'язково), за бажання [[finance.responsible]] та рядки; збережіть. Замовлення також можна отримати з прийнятої пропозиції кнопкою [[finance.makeOrder]].",
					),
					t3(
						"An order goes through the statuses [[finance.status_draft]], [[finance.status_confirmed]], [[finance.status_fulfilled]], [[finance.status_invoiced]], [[finance.status_closed]] and [[finance.status_cancelled]]. The main button depends on the status: for a draft it is [[finance.advance_confirmed]], for a confirmed order it is [[finance.advance_fulfilled]].",
						"Ein Auftrag durchläuft die Status [[finance.status_draft]], [[finance.status_confirmed]], [[finance.status_fulfilled]], [[finance.status_invoiced]], [[finance.status_closed]] und [[finance.status_cancelled]]. Die Hauptschaltfläche hängt vom Status ab: Bei einem Entwurf ist es [[finance.advance_confirmed]], bei einem bestätigten Auftrag [[finance.advance_fulfilled]].",
						"Замовлення проходить статуси [[finance.status_draft]], [[finance.status_confirmed]], [[finance.status_fulfilled]], [[finance.status_invoiced]], [[finance.status_closed]] і [[finance.status_cancelled]]. Головна кнопка залежить від статусу: для чернетки це [[finance.advance_confirmed]], для підтвердженого — [[finance.advance_fulfilled]].",
					),
					t3(
						"[[finance.advance_fulfilled]] also writes off the stock: for every line that has a product of the type \"good\" the quantity is subtracted from the stock (it may go below zero) and a stock movement is recorded. Lines with a service or without a product do not touch the stock.",
						"[[finance.advance_fulfilled]] bucht auch den Bestand ab: Für jede Zeile mit einem Produkt vom Typ „Ware“ wird die Menge vom Bestand abgezogen (er darf unter null fallen) und eine Lagerbewegung erfasst. Zeilen mit Dienstleistung oder ohne Produkt berühren den Bestand nicht.",
						"[[finance.advance_fulfilled]] також списує залишок: для кожного рядка з товаром типу «товар» кількість віднімається із залишку (він може піти нижче нуля) і записується рух складу. Рядки з послугою чи без товару залишок не чіпають.",
					),
					t3(
						"For a confirmed or fulfilled order without an invoice the button [[finance.makeInvoice]] appears. It creates an invoice draft with the same lines, moves the order to [[finance.status_invoiced]] (the order is then locked) and fires the automation event \"order status changed\". Afterwards the card shows the link [[finance.viewInvoice]].",
						"Bei einem bestätigten oder erfüllten Auftrag ohne Rechnung erscheint die Schaltfläche [[finance.makeInvoice]]. Sie erstellt einen Rechnungsentwurf mit denselben Positionen, setzt den Auftrag auf [[finance.status_invoiced]] (er ist dann gesperrt) und löst das Ereignis „Auftragsstatus geändert“ aus. Danach zeigt die Karte den Link [[finance.viewInvoice]].",
						"Для підтвердженого або виконаного замовлення без рахунку з'являється кнопка [[finance.makeInvoice]]. Вона створює чернетку рахунку з тими самими рядками, переводить замовлення в [[finance.status_invoiced]] (далі воно заблоковане) і запускає подію автоматизації «статус замовлення змінено». Потім на картці стоїть посилання [[finance.viewInvoice]].",
					),
					t3(
						"Other buttons on an order card: [[finance.downloadPdf]]; [[finance.deliveryNote]] (the delivery note gets its number the first time you issue it, and later the button shows that number; the tooltip is [[finance.deliveryCreate]]); [[finance.template]]. The text button [[finance.cancel]] is only there for drafts and moves the order to [[finance.status_cancelled]].",
						"Weitere Schaltflächen auf einer Auftragskarte: [[finance.downloadPdf]]; [[finance.deliveryNote]] (der Lieferschein erhält seine Nummer bei der ersten Ausstellung, danach zeigt die Schaltfläche diese Nummer; der Tooltip lautet [[finance.deliveryCreate]]); [[finance.template]]. Die Text-Schaltfläche [[finance.cancel]] gibt es nur bei Entwürfen und setzt den Auftrag auf [[finance.status_cancelled]].",
						"Інші кнопки на картці замовлення: [[finance.downloadPdf]]; [[finance.deliveryNote]] (накладна отримує номер під час першого випуску, далі кнопка показує цей номер; підказка — [[finance.deliveryCreate]]); [[finance.template]]. Текстова кнопка [[finance.cancel]] є лише для чернеток і переводить замовлення в [[finance.status_cancelled]].",
					),
				],
			},
			{
				title: t3("Contracts", "Verträge", "Договори"),
				steps: [
					t3(
						"Open [[finance.tab_contracts]] and press [[finance.newContract]]. The form has [[finance.customer]], [[finance.contractValue]], [[finance.startDate]] and [[finance.endDate]]. Save creates a contract in the status [[finance.cstatus_draft]].",
						"Öffnen Sie [[finance.tab_contracts]] und drücken Sie [[finance.newContract]]. Das Formular hat [[finance.customer]], [[finance.contractValue]], [[finance.startDate]] und [[finance.endDate]]. Speichern erzeugt einen Vertrag im Status [[finance.cstatus_draft]].",
						"Відкрийте [[finance.tab_contracts]] і натисніть [[finance.newContract]]. У формі є [[finance.customer]], [[finance.contractValue]], [[finance.startDate]] і [[finance.endDate]]. Збереження створює договір зі статусом [[finance.cstatus_draft]].",
					),
					t3(
						"The statuses are [[finance.cstatus_draft]], [[finance.cstatus_active]], [[finance.cstatus_completed]] and [[finance.cstatus_cancelled]]. A draft has [[finance.markSigned]] (moves it to active, shows the signature date and fires the event \"contract signed\") and [[finance.delete]] (after a confirmation). An active contract has [[finance.markCompleted]] and [[finance.cancel]].",
						"Die Status sind [[finance.cstatus_draft]], [[finance.cstatus_active]], [[finance.cstatus_completed]] und [[finance.cstatus_cancelled]]. Ein Entwurf hat [[finance.markSigned]] (setzt ihn auf aktiv, zeigt das Unterschriftsdatum und löst das Ereignis „Vertrag unterzeichnet“ aus) und [[finance.delete]] (nach einer Bestätigung). Ein aktiver Vertrag hat [[finance.markCompleted]] und [[finance.cancel]].",
						"Статуси: [[finance.cstatus_draft]], [[finance.cstatus_active]], [[finance.cstatus_completed]] і [[finance.cstatus_cancelled]]. У чернетки є [[finance.markSigned]] (переводить в активний, показує дату підпису і запускає подію «договір підписано») та [[finance.delete]] (після підтвердження). В активного договору — [[finance.markCompleted]] і [[finance.cancel]].",
					),
					t3(
						"In every status you can use [[finance.downloadPdf]] and [[finance.template]]. The contract here is a record with its parameters and a PDF; a scanned signed file is not attached in this tab (put it in Online Documents instead).",
						"In jedem Status stehen [[finance.downloadPdf]] und [[finance.template]] zur Verfügung. Der Vertrag ist hier ein Datensatz mit Eckdaten und PDF; eine eingescannte unterschriebene Datei wird in diesem Tab nicht angehängt (legen Sie sie stattdessen in Online Documents ab).",
						"У кожному статусі доступні [[finance.downloadPdf]] і [[finance.template]]. Договір тут — запис із параметрами та PDF; скан підписаного файлу в цій вкладці не додається (покладіть його в Online Documents).",
					),
				],
			},
			{
				title: t3("The Design button", "Die Schaltfläche Design", "Кнопка Дизайн"),
				steps: [
					t3(
						"Quotes, orders, contracts and invoices each have a [[finance.template]] button. It opens the window [[finance.templateTitle]] with ten miniature layouts: [[finance.tpl_classic]], [[finance.tpl_modern]], [[finance.tpl_minimal]], [[finance.tpl_boxed]], [[finance.tpl_sidebar]], [[finance.tpl_banner]], [[finance.tpl_twocol]], [[finance.tpl_compact]], [[finance.tpl_elegant]], [[finance.tpl_swiss]]. Click one to select it.",
						"Angebote, Aufträge, Verträge und Rechnungen haben je eine Schaltfläche [[finance.template]]. Sie öffnet das Fenster [[finance.templateTitle]] mit zehn Miniatur-Layouts: [[finance.tpl_classic]], [[finance.tpl_modern]], [[finance.tpl_minimal]], [[finance.tpl_boxed]], [[finance.tpl_sidebar]], [[finance.tpl_banner]], [[finance.tpl_twocol]], [[finance.tpl_compact]], [[finance.tpl_elegant]], [[finance.tpl_swiss]]. Ein Klick wählt ein Layout aus.",
						"Пропозиції, замовлення, договори та рахунки мають кнопку [[finance.template]]. Вона відкриває вікно [[finance.templateTitle]] з десятьма мініатюрами макетів: [[finance.tpl_classic]], [[finance.tpl_modern]], [[finance.tpl_minimal]], [[finance.tpl_boxed]], [[finance.tpl_sidebar]], [[finance.tpl_banner]], [[finance.tpl_twocol]], [[finance.tpl_compact]], [[finance.tpl_elegant]], [[finance.tpl_swiss]]. Клік вибирає макет.",
					),
					t3(
						"[[finance.preview]] downloads a PDF with the selected design so you can look at it before deciding; [[finance.save]] stores the design in this very document only; [[finance.templateReset]] goes back to the default design from the accounting settings.",
						"[[finance.preview]] lädt ein PDF mit dem gewählten Layout herunter, damit Sie es vor der Entscheidung ansehen können; [[finance.save]] speichert das Layout nur in diesem einen Dokument; [[finance.templateReset]] kehrt zum Standard-Layout aus den Buchhaltungs-Einstellungen zurück.",
						"[[finance.preview]] завантажує PDF з обраним макетом, щоб ви могли переглянути його перед рішенням; [[finance.save]] зберігає макет лише в цьому документі; [[finance.templateReset]] повертає типовий макет із бухгалтерських налаштувань.",
					),
				],
			},
		],
	},
];
