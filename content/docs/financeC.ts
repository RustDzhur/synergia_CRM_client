import { t3 } from "../i18n";
import type { DocSection } from "./types";

// Финансы, часть 3: расходы, товары, активы, банк и касса.
export const FINANCE_C: DocSection[] = [
	{
		id: "finance_money",
		title: t3("Finance: expenses, products, assets, bank", "Finanzen: Ausgaben, Produkte, Anlagen, Bank", "Фінанси: витрати, товари, активи, банк"),
		intro: t3(
			"These tabs record where money goes and what you own: [[finance.tab_expenses]], [[finance.tab_products]], [[finance.tab_assets]] and [[finance.tab_bank]]. Everything entered here feeds the tax reports and the overview.",
			"Diese Tabs erfassen, wohin das Geld fließt und was Sie besitzen: [[finance.tab_expenses]], [[finance.tab_products]], [[finance.tab_assets]] und [[finance.tab_bank]]. Alles hier Eingetragene fließt in die Steuerberichte und die Übersicht.",
			"Ці вкладки фіксують, куди йдуть гроші і чим ви володієте: [[finance.tab_expenses]], [[finance.tab_products]], [[finance.tab_assets]] і [[finance.tab_bank]]. Усе, що тут вводиться, потрапляє в податкові звіти й огляд.",
		),
		groups: [
			{
				title: t3("Expenses", "Ausgaben", "Витрати"),
				steps: [
					t3(
						"Open [[finance.tab_expenses]]. There are two buttons: [[finance.newExpense]] for manual entry and [[finance.scanReceipt]] to read a receipt automatically.",
						"Öffnen Sie [[finance.tab_expenses]]. Es gibt zwei Schaltflächen: [[finance.newExpense]] für die manuelle Eingabe und [[finance.scanReceipt]], um einen Beleg automatisch auszulesen.",
						"Відкрийте [[finance.tab_expenses]]. Є дві кнопки: [[finance.newExpense]] для ручного введення і [[finance.scanReceipt]] для автоматичного зчитування чека.",
					),
					t3(
						"[[finance.newExpense]] opens a form: [[finance.colVendor]] (required; without it the form shows [[finance.vendorRequired]]), [[finance.colCategory]], [[finance.colAmount]], [[finance.itemTax]] in percent and [[finance.colDate]]. Press [[finance.save]] or [[finance.cancel]].",
						"[[finance.newExpense]] öffnet ein Formular: [[finance.colVendor]] (Pflicht; ohne zeigt das Formular [[finance.vendorRequired]]), [[finance.colCategory]], [[finance.colAmount]], [[finance.itemTax]] in Prozent und [[finance.colDate]]. Drücken Sie [[finance.save]] oder [[finance.cancel]].",
						"[[finance.newExpense]] відкриває форму: [[finance.colVendor]] (обов'язково; без нього форма показує [[finance.vendorRequired]]), [[finance.colCategory]], [[finance.colAmount]], [[finance.itemTax]] у відсотках і [[finance.colDate]]. Натисніть [[finance.save]] або [[finance.cancel]].",
					),
					t3(
						"[[finance.scanReceipt]] opens a file picker (JPEG, PNG, WebP or PDF). The file is uploaded (a message [[finance.scanning]] shows the progress) and the AI reads the vendor, category, amount, tax, currency and date. On success ([[finance.scanDone]]) the expense form opens already filled in with the note [[finance.scannedFromReceipt]]. Nothing is saved until you check the values and press [[finance.save]]. If reading fails the message is [[finance.scanFailed]].",
						"[[finance.scanReceipt]] öffnet eine Dateiauswahl (JPEG, PNG, WebP oder PDF). Die Datei wird hochgeladen (die Meldung [[finance.scanning]] zeigt den Fortschritt) und die KI liest Lieferant, Kategorie, Betrag, Steuer, Währung und Datum aus. Bei Erfolg ([[finance.scanDone]]) öffnet sich das Ausgabenformular bereits ausgefüllt mit dem Hinweis [[finance.scannedFromReceipt]]. Gespeichert wird erst, wenn Sie die Werte prüfen und [[finance.save]] drücken. Schlägt das Auslesen fehl, lautet die Meldung [[finance.scanFailed]].",
						"[[finance.scanReceipt]] відкриває вибір файлу (JPEG, PNG, WebP або PDF). Файл завантажується (повідомлення [[finance.scanning]] показує хід), і ШІ зчитує постачальника, категорію, суму, податок, валюту та дату. У разі успіху ([[finance.scanDone]]) форма витрати відкривається вже заповненою з приміткою [[finance.scannedFromReceipt]]. Нічого не зберігається, доки ви не перевірите значення й не натиснете [[finance.save]]. Якщо зчитування не вдалося, повідомлення — [[finance.scanFailed]].",
					),
					t3(
						"Scanning needs the AI to be configured on the platform and uses the same daily AI request limit of your plan as Firmspace AI. If the receipt is in another currency than your firm's, the form additionally shows the field [[finance.currency]].",
						"Das Scannen setzt voraus, dass die KI auf der Plattform eingerichtet ist, und nutzt dasselbe tägliche KI-Anfragenlimit Ihres Tarifs wie Firmspace AI. Lautet der Beleg auf eine andere Währung als die Ihrer Firma, zeigt das Formular zusätzlich das Feld [[finance.currency]].",
						"Сканування потребує налаштованого на платформі ШІ і використовує той самий добовий ліміт запитів до ШІ вашого тарифу, що й Firmspace AI. Якщо чек в іншій валюті, ніж у вашої фірми, форма додатково показує поле [[finance.currency]].",
					),
					t3(
						"The table shows [[finance.colDate]], [[finance.colVendor]], [[finance.colCategory]] and [[finance.colAmount]]. The trash icon at the end of a row deletes the expense after a confirmation.",
						"Die Tabelle zeigt [[finance.colDate]], [[finance.colVendor]], [[finance.colCategory]] und [[finance.colAmount]]. Das Papierkorb-Symbol am Zeilenende löscht die Ausgabe nach einer Bestätigung.",
						"Таблиця показує [[finance.colDate]], [[finance.colVendor]], [[finance.colCategory]] і [[finance.colAmount]]. Іконка кошика в кінці рядка видаляє витрату після підтвердження.",
					),
					t3(
						"Expenses feed the profit tile, the input tax in [[finance.tab_vat]], [[finance.tab_eur]], [[finance.tab_bwa]] and the matching of outgoing bank payments.",
						"Ausgaben fließen in die Gewinn-Kachel, die Vorsteuer in [[finance.tab_vat]], [[finance.tab_eur]], [[finance.tab_bwa]] und den Abgleich ausgehender Bankzahlungen ein.",
						"Витрати потрапляють у плитку прибутку, вхідний податок у [[finance.tab_vat]], [[finance.tab_eur]], [[finance.tab_bwa]] та зіставлення вихідних банківських платежів.",
					),
				],
			},
			{
				title: t3("Products", "Produkte", "Товари"),
				steps: [
					t3(
						"Open [[finance.tab_products]]. The search field ([[finance.search]]) finds products by name or SKU. [[finance.newProduct]] opens the form.",
						"Öffnen Sie [[finance.tab_products]]. Das Suchfeld ([[finance.search]]) findet Produkte nach Name oder SKU. [[finance.newProduct]] öffnet das Formular.",
						"Відкрийте [[finance.tab_products]]. Поле пошуку ([[finance.search]]) знаходить товари за назвою чи SKU. [[finance.newProduct]] відкриває форму.",
					),
					t3(
						"The form fields: [[finance.itemDescription]] (required; otherwise [[finance.nameRequired]]), SKU, [[finance.colType]] ([[finance.typeService]] or [[finance.typeGood]]), [[finance.purchasePrice]], [[finance.salePrice]], [[finance.itemTax]] (empty means the default rate, hint [[finance.taxDefault]]) and [[finance.unit]] (\"pcs\" by default).",
						"Die Formularfelder: [[finance.itemDescription]] (Pflicht; sonst [[finance.nameRequired]]), SKU, [[finance.colType]] ([[finance.typeService]] oder [[finance.typeGood]]), [[finance.purchasePrice]], [[finance.salePrice]], [[finance.itemTax]] (leer bedeutet Standardsatz, Hinweis [[finance.taxDefault]]) und [[finance.unit]] (standardmäßig „Stk“).",
						"Поля форми: [[finance.itemDescription]] (обов'язково; інакше [[finance.nameRequired]]), SKU, [[finance.colType]] ([[finance.typeService]] або [[finance.typeGood]]), [[finance.purchasePrice]], [[finance.salePrice]], [[finance.itemTax]] (порожнє — типова ставка, підказка [[finance.taxDefault]]) і [[finance.unit]] (типово «шт»).",
					),
					t3(
						"For a good the form also shows [[finance.colStock]] (the starting quantity; when you edit an existing product this field is locked) and [[finance.reorderLevel]]. The hint [[finance.stockHint]] explains that the stock later changes only through order fulfilment.",
						"Bei einer Ware zeigt das Formular zusätzlich [[finance.colStock]] (die Anfangsmenge; beim Bearbeiten eines vorhandenen Produkts ist das Feld gesperrt) und [[finance.reorderLevel]]. Der Hinweis [[finance.stockHint]] erklärt, dass sich der Bestand später nur durch Auftragserfüllung ändert.",
						"Для товару форма також показує [[finance.colStock]] (початкова кількість; під час редагування наявного товару поле заблоковане) і [[finance.reorderLevel]]. Підказка [[finance.stockHint]] пояснює, що далі залишок змінюється лише через виконання замовлень.",
					),
					t3(
						"The table has [[finance.itemDescription]], SKU, [[finance.colType]], [[finance.colPrice]] and [[finance.colStock]]. The stock is shown only for goods; it turns red with a warning icon when it is at or below the reorder level. Click a row to edit the product ([[finance.editProduct]]); the trash icon deletes it after a confirmation.",
						"Die Tabelle hat [[finance.itemDescription]], SKU, [[finance.colType]], [[finance.colPrice]] und [[finance.colStock]]. Der Bestand wird nur bei Waren gezeigt; er wird rot mit Warnsymbol, sobald er auf oder unter der Meldemenge liegt. Ein Klick auf eine Zeile bearbeitet das Produkt ([[finance.editProduct]]); das Papierkorb-Symbol löscht es nach einer Bestätigung.",
						"У таблиці є [[finance.itemDescription]], SKU, [[finance.colType]], [[finance.colPrice]] і [[finance.colStock]]. Залишок показується лише для товарів; він червоніє з іконкою попередження, коли не перевищує порогу дозамовлення. Клік по рядку редагує товар ([[finance.editProduct]]); іконка кошика видаляє його після підтвердження.",
					),
				],
			},
			{
				title: t3("Assets and depreciation", "Anlagen und Abschreibung", "Активи та амортизація"),
				steps: [
					t3(
						"Open [[finance.tab_assets]]. At the top switch the period with [[finance.period_month]], [[finance.period_quarter]] or [[finance.period_year]]; it always means the current calendar month, quarter or year, and the range is written next to it ([[finance.periodLabel]]).",
						"Öffnen Sie [[finance.tab_assets]]. Oben stellen Sie den Zeitraum mit [[finance.period_month]], [[finance.period_quarter]] oder [[finance.period_year]] um; gemeint ist immer der aktuelle Kalendermonat, das Quartal oder das Jahr, der Bereich steht daneben ([[finance.periodLabel]]).",
						"Відкрийте [[finance.tab_assets]]. Угорі перемикайте період кнопками [[finance.period_month]], [[finance.period_quarter]] чи [[finance.period_year]]; це завжди поточний календарний місяць, квартал або рік, діапазон написано поруч ([[finance.periodLabel]]).",
					),
					t3(
						"Four tiles: [[finance.assetsTotalCost]], [[finance.assetsPeriodDepreciation]], [[finance.assetsDepreciationToDate]] and [[finance.assetsBookValue]].",
						"Vier Kacheln: [[finance.assetsTotalCost]], [[finance.assetsPeriodDepreciation]], [[finance.assetsDepreciationToDate]] und [[finance.assetsBookValue]].",
						"Чотири плитки: [[finance.assetsTotalCost]], [[finance.assetsPeriodDepreciation]], [[finance.assetsDepreciationToDate]] і [[finance.assetsBookValue]].",
					),
					t3(
						"Press [[finance.assetNew]]. The form: [[finance.assetName]], [[finance.colCategory]], [[finance.colAcquired]], [[finance.colCost]] (net of VAT, hint [[finance.assetCostHint]]), [[finance.colUsefulLife]] (1 to 100 years), [[finance.assetResidualValue]] (the part that is not depreciated) and [[finance.notes]]. The hint [[finance.assetLinearHint]] explains the method: straight-line, starting in the month of acquisition.",
						"Drücken Sie [[finance.assetNew]]. Das Formular: [[finance.assetName]], [[finance.colCategory]], [[finance.colAcquired]], [[finance.colCost]] (netto, Hinweis [[finance.assetCostHint]]), [[finance.colUsefulLife]] (1 bis 100 Jahre), [[finance.assetResidualValue]] (der nicht abgeschriebene Teil) und [[finance.notes]]. Der Hinweis [[finance.assetLinearHint]] erklärt die Methode: linear, beginnend im Monat der Anschaffung.",
						"Натисніть [[finance.assetNew]]. Форма: [[finance.assetName]], [[finance.colCategory]], [[finance.colAcquired]], [[finance.colCost]] (без ПДВ, підказка [[finance.assetCostHint]]), [[finance.colUsefulLife]] (від 1 до 100 років), [[finance.assetResidualValue]] (частина, що не амортизується) і [[finance.notes]]. Підказка [[finance.assetLinearHint]] пояснює метод: лінійний, починаючи з місяця придбання.",
					),
					t3(
						"If a field is wrong, a calm line inside the form says which one ([[finance.assetErrName]], [[finance.assetErrDate]], [[finance.assetErrCost]], [[finance.assetErrYears]]); nothing is saved until it is fixed.",
						"Ist ein Feld falsch, sagt eine ruhige Zeile im Formular, welches ([[finance.assetErrName]], [[finance.assetErrDate]], [[finance.assetErrCost]], [[finance.assetErrYears]]); gespeichert wird erst nach der Korrektur.",
						"Якщо поле заповнено неправильно, спокійний рядок у формі каже, яке саме ([[finance.assetErrName]], [[finance.assetErrDate]], [[finance.assetErrCost]], [[finance.assetErrYears]]); доки не виправлено, нічого не зберігається.",
					),
					t3(
						"The table shows [[finance.assetName]], [[finance.colCategory]], [[finance.colAcquired]], [[finance.colCost]], [[finance.colUsefulLife]], [[finance.colDepreciation]] and [[finance.colBookValue]]. In every row: the link [[finance.assetScheduleTitle]] opens a window with a month-by-month table (depreciation and book value, with a total); the calendar icon (disposal) opens [[finance.assetDisposeTitle]]; the trash icon deletes the asset after a confirmation.",
						"Die Tabelle zeigt [[finance.assetName]], [[finance.colCategory]], [[finance.colAcquired]], [[finance.colCost]], [[finance.colUsefulLife]], [[finance.colDepreciation]] und [[finance.colBookValue]]. In jeder Zeile: Der Link [[finance.assetScheduleTitle]] öffnet ein Fenster mit einer Monatstabelle (Abschreibung und Buchwert, mit Summe); das Kalender-Symbol (Abgang) öffnet [[finance.assetDisposeTitle]]; das Papierkorb-Symbol löscht die Anlage nach einer Bestätigung.",
						"Таблиця показує [[finance.assetName]], [[finance.colCategory]], [[finance.colAcquired]], [[finance.colCost]], [[finance.colUsefulLife]], [[finance.colDepreciation]] і [[finance.colBookValue]]. У кожному рядку: посилання [[finance.assetScheduleTitle]] відкриває вікно з помісячною таблицею (амортизація й балансова вартість, з підсумком); іконка календаря (вибуття) відкриває [[finance.assetDisposeTitle]]; іконка кошика видаляє актив після підтвердження.",
					),
					t3(
						"In the disposal window enter [[finance.assetDisposalDate]] and save; from that month the asset is no longer depreciated and the row shows a chip with the disposal date. [[finance.assetDisposalClear]] undoes the disposal. Depreciation feeds [[finance.tab_eur]] and [[finance.tab_bwa]].",
						"Im Abgangsfenster tragen Sie [[finance.assetDisposalDate]] ein und speichern; ab diesem Monat wird die Anlage nicht mehr abgeschrieben, und die Zeile zeigt ein Chip mit dem Abgangsdatum. [[finance.assetDisposalClear]] macht den Abgang rückgängig. Die Abschreibung fließt in [[finance.tab_eur]] und [[finance.tab_bwa]] ein.",
						"У вікні вибуття введіть [[finance.assetDisposalDate]] і збережіть; з цього місяця актив більше не амортизується, а рядок показує чип із датою вибуття. [[finance.assetDisposalClear]] скасовує вибуття. Амортизація потрапляє у [[finance.tab_eur]] і [[finance.tab_bwa]].",
					),
				],
			},
			{
				title: t3("Bank and cash: accounts", "Bank und Kasse: Konten", "Банк і каса: рахунки"),
				steps: [
					t3(
						"Open [[finance.tab_bank]]. The heading is [[finance.bankTitle]] with a hint. [[finance.bankNewAccount]] opens the form: [[finance.bankName]] (must be unique), [[finance.bankKind]] ([[finance.bankKindBank]] or [[finance.bankKindCash]]), [[finance.bankIban]], [[finance.bankBic]], [[finance.bankOpeningBalance]] and [[finance.bankOpeningDate]] (hint [[finance.bankOpeningHint]]).",
						"Öffnen Sie [[finance.tab_bank]]. Die Überschrift ist [[finance.bankTitle]] mit einem Hinweis. [[finance.bankNewAccount]] öffnet das Formular: [[finance.bankName]] (muss eindeutig sein), [[finance.bankKind]] ([[finance.bankKindBank]] oder [[finance.bankKindCash]]), [[finance.bankIban]], [[finance.bankBic]], [[finance.bankOpeningBalance]] und [[finance.bankOpeningDate]] (Hinweis [[finance.bankOpeningHint]]).",
						"Відкрийте [[finance.tab_bank]]. Заголовок — [[finance.bankTitle]] з підказкою. [[finance.bankNewAccount]] відкриває форму: [[finance.bankName]] (має бути унікальною), [[finance.bankKind]] ([[finance.bankKindBank]] або [[finance.bankKindCash]]), [[finance.bankIban]], [[finance.bankBic]], [[finance.bankOpeningBalance]] і [[finance.bankOpeningDate]] (підказка [[finance.bankOpeningHint]]).",
					),
					t3(
						"Under [[finance.bankAccounts]] each account is a card with the name, a chip bank or cash, the number of unmatched movements (or [[finance.bankAllMatched]]) and the number of movements. Click a card to open the account.",
						"Unter [[finance.bankAccounts]] ist jedes Konto eine Karte mit Name, einem Chip Bank oder Kasse, der Zahl offener Umsätze (oder [[finance.bankAllMatched]]) und der Zahl der Umsätze. Ein Klick auf die Karte öffnet das Konto.",
						"У [[finance.bankAccounts]] кожен рахунок — картка з назвою, чипом банк чи каса, кількістю неузгоджених рухів (або [[finance.bankAllMatched]]) і кількістю рухів. Клік по картці відкриває рахунок.",
					),
				],
			},
			{
				title: t3("Bank and cash: movements and import", "Bank und Kasse: Umsätze und Import", "Банк і каса: рухи та імпорт"),
				steps: [
					t3(
						"Inside an account, [[finance.bankBack]] returns to the list. The header shows the name, the kind, the IBAN and the period switch (month, quarter, year; always the current one). Tiles: [[finance.bankOpeningBalance]], [[finance.bankPeriodMovements]] and the balance as of the end of the period.",
						"Im Konto führt [[finance.bankBack]] zurück zur Liste. Der Kopf zeigt Name, Art, IBAN und den Zeitraum-Umschalter (Monat, Quartal, Jahr; immer der aktuelle). Kacheln: [[finance.bankOpeningBalance]], [[finance.bankPeriodMovements]] und der Saldo zum Periodenende.",
						"Усередині рахунку [[finance.bankBack]] повертає до списку. Шапка показує назву, вид, IBAN і перемикач періоду (місяць, квартал, рік; завжди поточний). Плитки: [[finance.bankOpeningBalance]], [[finance.bankPeriodMovements]] і залишок на кінець періоду.",
					),
					t3(
						"Note: this balance is the opening balance plus only the movements of the selected period. Movements booked before the period are not included, so for a long history choose the year or check the opening balance.",
						"Hinweis: Dieser Saldo ist der Anfangssaldo plus nur die Umsätze des gewählten Zeitraums. Vor dem Zeitraum gebuchte Umsätze sind nicht enthalten; bei langer Historie wählen Sie daher das Jahr oder prüfen den Anfangssaldo.",
						"Зверніть увагу: цей залишок — початковий залишок плюс лише рухи обраного періоду. Рухи, проведені до періоду, не враховуються, тож за довгої історії оберіть рік або перевірте початковий залишок.",
					),
					t3(
						"The chip [[finance.bankOnlyUnmatched]] toggles a filter that shows only movements that are not linked yet (it turns green with a check mark when on).",
						"Das Chip [[finance.bankOnlyUnmatched]] schaltet einen Filter um, der nur noch nicht zugeordnete Umsätze zeigt (es wird grün mit Häkchen, wenn aktiv).",
						"Чип [[finance.bankOnlyUnmatched]] вмикає фільтр, що показує лише ще не пов'язані рухи (коли він активний, він стає зеленим із галочкою).",
					),
					t3(
						"Two buttons add movements: [[finance.bankImport]] (choose a CSV file; while it works it says [[finance.bankImportBusy]]) and [[finance.bankAddMovement]]. For a bank account the import is the main button; for a cash box [[finance.bankAddMovement]] is the main one, because a cash book is kept by hand.",
						"Zwei Schaltflächen fügen Umsätze hinzu: [[finance.bankImport]] (CSV-Datei wählen; währenddessen steht [[finance.bankImportBusy]]) und [[finance.bankAddMovement]]. Bei einem Bankkonto ist der Import die Hauptschaltfläche; bei einer Kasse ist es [[finance.bankAddMovement]], weil ein Kassenbuch von Hand geführt wird.",
						"Дві кнопки додають рухи: [[finance.bankImport]] (оберіть файл CSV; під час роботи показує [[finance.bankImportBusy]]) і [[finance.bankAddMovement]]. Для банківського рахунку головна кнопка — імпорт; для каси головна — [[finance.bankAddMovement]], бо касову книгу ведуть вручну.",
					),
					t3(
						"The manual movement form has the hint [[finance.bankManualHint]] and the fields [[finance.colDate]], [[finance.colAmount]] (positive means incoming, negative means outgoing, hint [[finance.bankAmountHint]]; zero is refused), [[finance.colCounterparty]], [[finance.colReference]] and [[finance.notes]].",
						"Das Formular für eine manuelle Buchung hat den Hinweis [[finance.bankManualHint]] und die Felder [[finance.colDate]], [[finance.colAmount]] (positiv heißt Eingang, negativ Ausgang, Hinweis [[finance.bankAmountHint]]; null wird abgelehnt), [[finance.colCounterparty]], [[finance.colReference]] und [[finance.notes]].",
						"Форма ручного руху має підказку [[finance.bankManualHint]] і поля [[finance.colDate]], [[finance.colAmount]] (додатне — надходження, від'ємне — списання, підказка [[finance.bankAmountHint]]; нуль відхиляється), [[finance.colCounterparty]], [[finance.colReference]] і [[finance.notes]].",
					),
					t3(
						"CSV import: the separator is detected automatically. The header row is recognised by German or English names. Date: Buchungstag, Buchungsdatum, Datum, Valuta, Wertstellung, Date, Booking date. Amount: Betrag, Umsatz, Amount, Summe, Soll, Haben. Counterparty: Begünstigter, Auftraggeber, Empfänger, Name, Zahlungspflichtiger, Payee, Payer. Reference: Verwendungszweck, Buchungstext, Referenz, Beschreibung, Description, Details, Payment reference. Optional transaction id: Auftragsnummer, Referenznummer, Belegnummer, Transaktionsnummer, ID, Transaction id.",
						"CSV-Import: Das Trennzeichen wird automatisch erkannt. Die Kopfzeile wird an deutschen oder englischen Namen erkannt. Datum: Buchungstag, Buchungsdatum, Datum, Valuta, Wertstellung, Date, Booking date. Betrag: Betrag, Umsatz, Amount, Summe, Soll, Haben. Gegenpartei: Begünstigter, Auftraggeber, Empfänger, Name, Zahlungspflichtiger, Payee, Payer. Verwendungszweck: Verwendungszweck, Buchungstext, Referenz, Beschreibung, Description, Details, Payment reference. Optionale Transaktions-ID: Auftragsnummer, Referenznummer, Belegnummer, Transaktionsnummer, ID, Transaction id.",
						"Імпорт CSV: роздільник визначається автоматично. Рядок заголовків розпізнається за німецькими чи англійськими назвами. Дата: Buchungstag, Buchungsdatum, Datum, Valuta, Wertstellung, Date, Booking date. Сума: Betrag, Umsatz, Amount, Summe, Soll, Haben. Контрагент: Begünstigter, Auftraggeber, Empfänger, Name, Zahlungspflichtiger, Payee, Payer. Призначення: Verwendungszweck, Buchungstext, Referenz, Beschreibung, Description, Details, Payment reference. Необов'язковий id операції: Auftragsnummer, Referenznummer, Belegnummer, Transaktionsnummer, ID, Transaction id.",
					),
					t3(
						"Without a recognisable header the columns are taken in the order date, amount, counterparty, reference. Accepted dates: 31.12.2026, 2026-12-31, 31/12/2026, 20261231. Accepted amounts: 1.234,56, 1,234.56, -1234.56. Lines that cannot be read are skipped; rows whose transaction id was already imported are skipped; a file without rows gives the error [[finance.bankErrNoRows]].",
						"Ohne erkennbare Kopfzeile werden die Spalten in der Reihenfolge Datum, Betrag, Gegenpartei, Verwendungszweck gelesen. Akzeptierte Daten: 31.12.2026, 2026-12-31, 31/12/2026, 20261231. Akzeptierte Beträge: 1.234,56, 1,234.56, -1234.56. Nicht lesbare Zeilen werden übersprungen; Zeilen, deren Transaktions-ID schon importiert wurde, ebenfalls; eine Datei ohne Zeilen ergibt den Fehler [[finance.bankErrNoRows]].",
						"Без розпізнаваного заголовка колонки беруться в порядку дата, сума, контрагент, призначення. Прийнятні дати: 31.12.2026, 2026-12-31, 31/12/2026, 20261231. Прийнятні суми: 1.234,56, 1,234.56, -1234.56. Нечитабельні рядки пропускаються; рядки, чий id операції вже імпортовано, теж; файл без рядків дає помилку [[finance.bankErrNoRows]].",
					),
					t3(
						"After the import a line reports the result: how many rows were imported, how many skipped and how many suggestions were found. On import the CRM links a movement automatically only when the match is confident (the document number is in the reference, or the amount and the date fit closely). A weak match (amount only) is not linked; it only counts as a suggestion.",
						"Nach dem Import meldet eine Zeile das Ergebnis: wie viele Zeilen importiert, übersprungen und wie viele Vorschläge gefunden wurden. Beim Import ordnet das CRM einen Umsatz nur bei sicherem Treffer automatisch zu (die Belegnummer steht im Verwendungszweck oder Betrag und Datum passen eng). Ein schwacher Treffer (nur der Betrag) wird nicht zugeordnet, sondern zählt nur als Vorschlag.",
						"Після імпорту рядок повідомляє результат: скільки рядків імпортовано, скільки пропущено і скільки знайдено підказок. Під час імпорту CRM пов'язує рух автоматично лише за впевненого збігу (номер документа є в призначенні, або сума й дата близько збігаються). Слабкий збіг (лише сума) не пов'язується, а лише враховується як підказка.",
					),
				],
			},
			{
				title: t3("Bank and cash: matching", "Bank und Kasse: Zuordnung", "Банк і каса: зіставлення"),
				steps: [
					t3(
						"The movements table has the columns [[finance.colDate]], [[finance.colCounterparty]], [[finance.colReference]], [[finance.colAmount]] and [[finance.bankColMatch]]. The last column shows the chip [[finance.bankMatchNone]] or the link to the target (an invoice with its number, an expense with its vendor, or a manual entry).",
						"Die Umsatztabelle hat die Spalten [[finance.colDate]], [[finance.colCounterparty]], [[finance.colReference]], [[finance.colAmount]] und [[finance.bankColMatch]]. Die letzte Spalte zeigt das Chip [[finance.bankMatchNone]] oder den Link zum Ziel (eine Rechnung mit Nummer, eine Ausgabe mit Lieferant oder ein manueller Eintrag).",
						"Таблиця рухів має колонки [[finance.colDate]], [[finance.colCounterparty]], [[finance.colReference]], [[finance.colAmount]] і [[finance.bankColMatch]]. Остання колонка показує чип [[finance.bankMatchNone]] або посилання на ціль (рахунок з номером, витрату з постачальником чи ручний запис).",
					),
					t3(
						"Press [[finance.bankMatch]] on a movement. The window [[finance.bankMatchTitle]] looks at documents within 90 days around the booking date. An incoming amount is matched against open invoices (sent or overdue); an outgoing amount against expenses. Up to 50 candidates are listed, closest first, with the badges [[finance.bankMatchSuggestion]] (and the reason: [[finance.bankReason_reference]], [[finance.bankReason_amount_date]] or [[finance.bankReason_amount]]) and [[finance.bankMatchAmount]]. With no candidates the window says [[finance.bankNoCandidates]].",
						"Drücken Sie [[finance.bankMatch]] bei einem Umsatz. Das Fenster [[finance.bankMatchTitle]] betrachtet Belege im Umkreis von 90 Tagen um das Buchungsdatum. Ein Eingang wird mit offenen Rechnungen (versendet oder überfällig) abgeglichen, ein Ausgang mit Ausgaben. Bis zu 50 Kandidaten werden gelistet, die nächsten zuerst, mit den Marken [[finance.bankMatchSuggestion]] (und dem Grund: [[finance.bankReason_reference]], [[finance.bankReason_amount_date]] oder [[finance.bankReason_amount]]) und [[finance.bankMatchAmount]]. Ohne Kandidaten steht im Fenster [[finance.bankNoCandidates]].",
						"Натисніть [[finance.bankMatch]] на русі. Вікно [[finance.bankMatchTitle]] дивиться на документи в межах 90 днів навколо дати проведення. Надходження зіставляється з відкритими рахунками (надісланими чи простроченими), списання — з витратами. Показується до 50 кандидатів, найближчі першими, з позначками [[finance.bankMatchSuggestion]] (та причиною: [[finance.bankReason_reference]], [[finance.bankReason_amount_date]] або [[finance.bankReason_amount]]) і [[finance.bankMatchAmount]]. Якщо кандидатів немає, вікно каже [[finance.bankNoCandidates]].",
					),
					t3(
						"Important: linking only stores the connection on the movement. It does not mark the invoice as paid; do that separately with [[finance.markPaid]] in [[finance.tab_invoices]]. [[finance.bankUnlink]] removes the connection again.",
						"Wichtig: Das Zuordnen speichert nur die Verbindung am Umsatz. Es markiert die Rechnung nicht als bezahlt; das tun Sie separat mit [[finance.markPaid]] in [[finance.tab_invoices]]. [[finance.bankUnlink]] löst die Verbindung wieder.",
						"Важливо: зіставлення лише зберігає зв'язок на русі. Воно не позначає рахунок оплаченим; зробіть це окремо кнопкою [[finance.markPaid]] у [[finance.tab_invoices]]. [[finance.bankUnlink]] знову розриває зв'язок.",
					),
					t3(
						"The trash icon of a movement deletes it after a confirmation. Under the table you see the number of movements; [[finance.bankClearImported]] (shown only when imported rows exist) deletes all imported movements after a confirmation, while movements you entered by hand are kept.",
						"Das Papierkorb-Symbol eines Umsatzes löscht ihn nach einer Bestätigung. Unter der Tabelle steht die Zahl der Umsätze; [[finance.bankClearImported]] (nur sichtbar, wenn importierte Zeilen existieren) löscht alle importierten Umsätze nach einer Bestätigung, von Hand erfasste bleiben erhalten.",
						"Іконка кошика руху видаляє його після підтвердження. Під таблицею — кількість рухів; [[finance.bankClearImported]] (видно лише за наявності імпортованих рядків) видаляє всі імпортовані рухи після підтвердження, а внесені вручну лишаються.",
					),
				],
			},
		],
	},
];
