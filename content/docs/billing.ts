import { t3 } from "../i18n";
import type { DocSection } from "./types";

export const BILLING_DOCS: DocSection[] = [
	{
		id: "billing",
		title: t3("Plans and billing", "Tarife und Abrechnung", "Тарифи та оплата"),
		intro: t3(
			"[[navigation.upgrade_plan]] is the page where the plan of the firm is chosen and paid. The plan belongs to the firm, not to a person, and decides which sections and how much of them are available. Only the owner of the firm can pay and change the plan; the page and the payment functions are not available to other roles.",
			"[[navigation.upgrade_plan]] ist die Seite, auf der der Tarif der Firma gewählt und bezahlt wird. Der Tarif gehört zur Firma, nicht zu einer Person, und bestimmt, welche Bereiche und wie viel davon verfügbar sind. Nur der Inhaber der Firma kann bezahlen und den Tarif ändern; für andere Rollen sind die Seite und die Zahlungsfunktionen nicht verfügbar.",
			"[[navigation.upgrade_plan]] — сторінка, де обирають і оплачують тариф фірми. Тариф належить фірмі, а не людині, і визначає, які розділи та в якому обсязі доступні. Лише власник фірми може платити й змінювати тариф; для інших ролей сторінка та платіжні функції недоступні.",
		),
		groups: [
			{
				title: t3("What each plan contains", "Was jeder Tarif enthält", "Що містить кожен тариф"),
				steps: [
					t3(
						"[[upgrade.free]]: €0. One user; [[upgrade.crm]] and [[upgrade.tasks]]; no automation rules, no AI requests and no document storage.",
						"[[upgrade.free]]: 0 €. Ein Benutzer; [[upgrade.crm]] und [[upgrade.tasks]]; keine Automatisierungsregeln, keine KI-Anfragen und kein Dokumentenspeicher.",
						"[[upgrade.free]]: €0. Один користувач; [[upgrade.crm]] та [[upgrade.tasks]]; без правил автоматизації, без запитів до ШІ та без сховища документів.",
					),
					t3(
						"[[upgrade.standard]]: €20 per month. Up to 50 users; everything of Free plus [[upgrade.company]], [[upgrade.collab]] and [[upgrade.multiFirm]]; no automation, AI assistant or document storage.",
						"[[upgrade.standard]]: 20 € pro Monat. Bis zu 50 Benutzer; alles aus Free plus [[upgrade.company]], [[upgrade.collab]] und [[upgrade.multiFirm]]; keine Automatisierung, kein KI-Assistent und kein Dokumentenspeicher.",
						"[[upgrade.standard]]: €20 на місяць. До 50 користувачів; усе з Free плюс [[upgrade.company]], [[upgrade.collab]] та [[upgrade.multiFirm]]; без автоматизації, ШІ-асистента та сховища документів.",
					),
					t3(
						"[[upgrade.professional]]: €53 per month. Unlimited users; all sections, including [[upgrade.documents]], [[upgrade.channels]], [[upgrade.mail]], [[upgrade.inventory]], [[upgrade.automation]], [[upgrade.aiAssistant]], [[upgrade.marketing]], [[upgrade.ads]] and [[upgrade.aiAutomation]]; 10 GB of storage. The card carries the line “[[upgrade.fullAccess]]”.",
						"[[upgrade.professional]]: 53 € pro Monat. Unbegrenzt viele Benutzer; alle Bereiche, einschließlich [[upgrade.documents]], [[upgrade.channels]], [[upgrade.mail]], [[upgrade.inventory]], [[upgrade.automation]], [[upgrade.aiAssistant]], [[upgrade.marketing]], [[upgrade.ads]] und [[upgrade.aiAutomation]]; 10 GB Speicher. Die Karte trägt die Zeile „[[upgrade.fullAccess]]“.",
						"[[upgrade.professional]]: €53 на місяць. Необмежена кількість користувачів; усі розділи, зокрема [[upgrade.documents]], [[upgrade.channels]], [[upgrade.mail]], [[upgrade.inventory]], [[upgrade.automation]], [[upgrade.aiAssistant]], [[upgrade.marketing]], [[upgrade.ads]] та [[upgrade.aiAutomation]]; 10 ГБ сховища. Картка має рядок «[[upgrade.fullAccess]]».",
					),
					t3(
						"Under the price the card names the limits that really apply to the plan (“rules · AI requests/day · storage”). Free and Standard show no such line, because automation, the AI assistant and document storage are part of Professional; Professional shows 200 rules, 300 AI requests a day and 10 GB.",
						"Unter dem Preis nennt die Karte die Grenzen, die für den Tarif wirklich gelten („Regeln · KI-Anfragen/Tag · Speicher“). Free und Standard zeigen keine solche Zeile, weil Automatisierung, KI-Assistent und Dokumentenspeicher zu Professional gehören; Professional zeigt 200 Regeln, 300 KI-Anfragen pro Tag und 10 GB.",
						"Під ціною картка називає ліміти, що справді діють для тарифу («правила · запити до ШІ/день · сховище»). Free і Standard такого рядка не мають, бо автоматизація, ШІ-асистент і сховище документів входять у Professional; Professional показує 200 правил, 300 запитів до ШІ на день і 10 ГБ.",
					),
					t3(
						"If a section is not in the plan, its menu item is hidden, its data are refused by the server, and an attempt to open it by a direct link leads to this page with an orange notice at the top (see below).",
						"Gehört ein Bereich nicht zum Tarif, ist sein Menüpunkt ausgeblendet, der Server verweigert seine Daten, und der Versuch, ihn über einen direkten Link zu öffnen, führt zu dieser Seite mit einem orangefarbenen Hinweis oben (siehe unten).",
						"Якщо розділу немає в тарифі, його пункт меню приховано, сервер відмовляє в його даних, а спроба відкрити його прямим посиланням веде на цю сторінку з помаранчевим повідомленням угорі (див. нижче).",
					),
				],
			},
			{
				title: t3("The page: period, notices and cards", "Die Seite: Zeitraum, Hinweise und Karten", "Сторінка: період, повідомлення й картки"),
				steps: [
					t3(
						"At the top is a switch [[upgrade.monthly]] / [[upgrade.yearly]]. The yearly option carries a badge “2 months free”: a year costs ten months (€200 for Standard, €530 for Professional). The prices on the cards change at once, with “per month” or “per year” next to them.",
						"Oben steht ein Umschalter [[upgrade.monthly]] / [[upgrade.yearly]]. Die Jahresoption trägt ein Abzeichen „2 Monate gratis“: Ein Jahr kostet zehn Monate (200 € für Standard, 530 € für Professional). Die Preise auf den Karten wechseln sofort, mit „pro Monat“ oder „pro Jahr“ daneben.",
						"Угорі перемикач [[upgrade.monthly]] / [[upgrade.yearly]]. Річний варіант має значок «2 місяці безкоштовно»: рік коштує десять місяців (€200 за Standard, €530 за Professional). Ціни на картках змінюються одразу, поруч стоїть «на місяць» або «на рік».",
					),
					t3(
						"Above the cards a notice may appear. Orange: you came from a locked section — “… is not included in your current plan. Please change your plan first.” with the name of that section. If you already have an unpaid invoice, a list [[upgrade.openInvoices]] shows it with the status (awaiting payment / awaiting confirmation) and the link [[upgrade.openInvoice]].",
						"Über den Karten kann ein Hinweis erscheinen. Orange: Sie kamen aus einem gesperrten Bereich — „… ist in Ihrem aktuellen Tarif nicht enthalten. Bitte ändern Sie zuerst Ihren Tarif.“ mit dem Namen dieses Bereichs. Haben Sie bereits eine unbezahlte Rechnung, zeigt die Liste [[upgrade.openInvoices]] sie mit dem Status (wartet auf Zahlung / wartet auf Bestätigung) und dem Link [[upgrade.openInvoice]].",
						"Над картками може з’явитися повідомлення. Помаранчеве: ви прийшли із заблокованого розділу — «… не входить у ваш поточний тариф. Спершу змініть тариф.» з назвою цього розділу. Якщо у вас уже є неоплачений рахунок, список [[upgrade.openInvoices]] показує його зі статусом (очікує оплати / очікує підтвердження) і посиланням [[upgrade.openInvoice]].",
					),
					t3(
						"Three cards stand in a row: [[upgrade.free]], [[upgrade.standard]], [[upgrade.professional]]. Each shows an icon, the name, the price, “Up to N users” (or [[upgrade.unlimitedUsers]]), the line with limits and the list of all fourteen features: what is included has a green tick, what is not is grey and struck through. The card of your current plan has a green border and a chip [[upgrade.currentPlan]].",
						"Drei Karten stehen in einer Reihe: [[upgrade.free]], [[upgrade.standard]], [[upgrade.professional]]. Jede zeigt ein Symbol, den Namen, den Preis, „Bis zu N Benutzer“ (oder [[upgrade.unlimitedUsers]]), die Zeile mit den Grenzen und die Liste aller vierzehn Funktionen: Was enthalten ist, hat ein grünes Häkchen, was nicht, ist grau und durchgestrichen. Die Karte Ihres aktuellen Tarifs hat einen grünen Rand und einen Chip [[upgrade.currentPlan]].",
						"Три картки стоять у ряд: [[upgrade.free]], [[upgrade.standard]], [[upgrade.professional]]. Кожна показує значок, назву, ціну, «До N користувачів» (або [[upgrade.unlimitedUsers]]), рядок із лімітами й перелік усіх чотирнадцяти функцій: що входить — має зелену галочку, що ні — сіре й закреслене. Картка вашого поточного тарифу має зелену рамку та чип [[upgrade.currentPlan]].",
					),
					t3(
						"On the current paid card a line under the price tells how long the plan runs: “Active until <date> (paid in advance)”. Prices are shown in the currency of your market: euro for Germany, hryvnia for Ukraine (the market follows the country set in the finance settings of the firm).",
						"Auf der aktuellen bezahlten Karte sagt eine Zeile unter dem Preis, wie lange der Tarif läuft: „Aktiv bis <Datum> (im Voraus bezahlt)“. Die Preise stehen in der Währung Ihres Marktes: Euro für Deutschland, Hrywnja für die Ukraine (der Markt folgt dem Land in den Finanzeinstellungen der Firma).",
						"На поточній платній картці рядок під ціною каже, як довго діє тариф: «Діє до <дата> (оплачено наперед)». Ціни показано у валюті вашого ринку: євро для Німеччини, гривня для України (ринок визначає країна в налаштуваннях бухгалтерії фірми).",
					),
				],
			},
			{
				title: t3("Paying for a plan", "Tarif bezahlen", "Оплата тарифу"),
				steps: [
					t3(
						"Plans are paid by transfer, without payment services and their fees: by bank transfer or in USDT. Press [[upgrade.buy]] on the plan you want (choose the period first). A window [[upgrade.payTitle]] opens: pick [[upgrade.viaBank]] or USDT, fill in [[upgrade.invoiceCompany]] (and, if you wish, [[upgrade.invoiceVat]]) and press [[upgrade.makeInvoice]]. The button is inactive while the platform has not set up any payment method; then write to the Firmspace team and they will invoice you by hand.",
						"Tarife werden per Überweisung bezahlt, ohne Zahlungsdienste und deren Gebühren: per Banküberweisung oder in USDT. Drücken Sie [[upgrade.buy]] beim gewünschten Tarif (wählen Sie zuerst den Zeitraum). Es öffnet sich das Fenster [[upgrade.payTitle]]: Wählen Sie [[upgrade.viaBank]] oder USDT, füllen Sie [[upgrade.invoiceCompany]] (und, wenn Sie möchten, [[upgrade.invoiceVat]]) aus und drücken Sie [[upgrade.makeInvoice]]. Die Schaltfläche ist inaktiv, solange die Plattform keine Zahlungsart eingerichtet hat; schreiben Sie dann dem Firmspace-Team, es stellt die Rechnung von Hand aus.",
						"Тарифи оплачують переказом, без платіжних сервісів і їхніх комісій: банківським переказом або в USDT. Натисніть [[upgrade.buy]] на потрібному тарифі (спершу оберіть період). Відкриється вікно [[upgrade.payTitle]]: оберіть [[upgrade.viaBank]] або USDT, заповніть [[upgrade.invoiceCompany]] (і за бажанням [[upgrade.invoiceVat]]) та натисніть [[upgrade.makeInvoice]]. Кнопка неактивна, поки платформа не налаштувала жодного способу оплати; тоді напишіть команді Firmspace — вона виставить рахунок вручну.",
					),
					t3(
						"The invoice (number FS-year-number) shows the amount to pay, a QR code and the details with copy buttons. The currency and the details are chosen for you: Germany — euro with German bank details (the QR code is a Girocode that banking apps of the SEPA area understand); Ukraine — hryvnia with Ukrainian details (QR code of the National Bank of Ukraine); USDT — the exact amount to a wallet in the TRC-20 (Tron) network, other networks are not credited. The button [[upgrade.downloadPdf]] saves the same invoice as a PDF.",
						"Die Rechnung (Nummer FS-Jahr-Nummer) zeigt den Betrag, einen QR-Code und die Daten mit Kopier-Schaltflächen. Währung und Daten werden für Sie gewählt: Deutschland — Euro mit deutscher Bankverbindung (der QR-Code ist ein Girocode, den Banking-Apps im SEPA-Raum verstehen); Ukraine — Hrywnja mit ukrainischen Daten (QR-Code der Nationalbank der Ukraine); USDT — der genaue Betrag an eine Wallet im Netzwerk TRC-20 (Tron), andere Netzwerke werden nicht gutgeschrieben. Die Schaltfläche [[upgrade.downloadPdf]] speichert dieselbe Rechnung als PDF.",
						"Рахунок (номер FS-рік-номер) показує суму, QR-код і реквізити з кнопками копіювання. Валюту й реквізити підставляють за вас: Німеччина — євро з німецькими банківськими реквізитами (QR-код — Girocode, який розуміють банківські застосунки зони SEPA); Україна — гривня з українськими реквізитами (QR-код НБУ); USDT — точна сума на гаманець у мережі TRC-20 (Tron), інші мережі не зараховуються. Кнопка [[upgrade.downloadPdf]] зберігає той самий рахунок у PDF.",
					),
					t3(
						"Pay in your banking app (scan the QR code or copy the details; put the invoice number into the payment reference) or send USDT from a wallet, then press [[upgrade.iPaid]]. You can add the payment date and payer name, or the transaction hash for USDT. The status becomes “awaiting confirmation”: the platform team checks that the money has arrived and confirms the payment — usually within a day. After that the plan is on for a month or a year; renewal of the same plan counts from the end of the current term.",
						"Zahlen Sie in Ihrer Banking-App (QR-Code scannen oder Daten kopieren; die Rechnungsnummer gehört in den Verwendungszweck) oder senden Sie USDT aus einer Wallet und drücken Sie dann [[upgrade.iPaid]]. Sie können Zahlungsdatum und Namen des Zahlers oder bei USDT den Transaktions-Hash angeben. Der Status wechselt zu „wartet auf Bestätigung“: Das Plattform-Team prüft den Geldeingang und bestätigt die Zahlung — meist innerhalb eines Tages. Danach ist der Tarif für einen Monat bzw. ein Jahr aktiv; die Verlängerung desselben Tarifs zählt ab dem Ende der laufenden Laufzeit.",
						"Сплатіть у банківському застосунку (відскануйте QR-код або скопіюйте реквізити; номер рахунку вкажіть у призначенні платежу) або надішліть USDT із гаманця, потім натисніть [[upgrade.iPaid]]. Можна додати дату й ім’я платника, а для USDT — хеш транзакції. Статус стане «очікує підтвердження»: команда платформи перевіряє, що гроші надійшли, і підтверджує оплату — зазвичай протягом доби. Після цього тариф діє місяць або рік; продовження того самого тарифу рахується від кінця чинного терміну.",
					),
					t3(
						"If you registered from the price list of the public website by pressing a plan there, the CRM opens this same invoice window for that plan and period by itself right after registration — you do not have to press [[upgrade.buy]] again.",
						"Haben Sie sich über die Preisliste der öffentlichen Website durch Drücken eines Tarifs registriert, öffnet das CRM gleich nach der Registrierung dasselbe Rechnungsfenster für diesen Tarif und Zeitraum von selbst — Sie müssen [[upgrade.buy]] nicht noch einmal drücken.",
						"Якщо ви зареєструвалися з прайсу публічного сайту, натиснувши там тариф, CRM одразу після реєстрації сама відкриває те саме вікно рахунку для цього тарифу й періоду — повторно натискати [[upgrade.buy]] не треба.",
					),
					t3(
						"When the paid term ends, the firm returns to Free; nothing is deleted, but sections that are not in Free become unavailable until you pay again. The platform team can also assign a plan to a firm directly (for example for a trial or a partner). Such an assignment is shown as “Active until <date>” when it has an end date.",
						"Endet die bezahlte Laufzeit, fällt die Firma auf Free zurück; nichts wird gelöscht, aber Bereiche, die nicht in Free enthalten sind, sind bis zur nächsten Zahlung nicht verfügbar. Das Plattform-Team kann einer Firma einen Tarif auch direkt zuweisen (zum Beispiel für einen Test oder einen Partner). Eine solche Zuweisung wird als „Aktiv bis <Datum>“ gezeigt, wenn sie ein Enddatum hat.",
						"Коли оплачений термін закінчується, фірма повертається на Free; нічого не видаляється, але розділи, яких немає у Free, стають недоступними, доки ви не оплатите знову. Команда платформи може також призначити фірмі тариф напряму (наприклад, для тесту чи партнера). Таке призначення показується як «Діє до <дата>», якщо в нього є дата завершення.",
					),
				],
			},
		],
	},
];
