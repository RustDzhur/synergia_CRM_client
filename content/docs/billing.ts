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
						"[[upgrade.free]]: €0. One user; [[upgrade.crm]] and [[upgrade.tasks]]; no automation rules and no AI requests; 500 MB of storage.",
						"[[upgrade.free]]: 0 €. Ein Benutzer; [[upgrade.crm]] und [[upgrade.tasks]]; keine Automatisierungsregeln und keine KI-Anfragen; 500 MB Speicher.",
						"[[upgrade.free]]: €0. Один користувач; [[upgrade.crm]] та [[upgrade.tasks]]; без правил автоматизації та без запитів до ШІ; 500 МБ сховища.",
					),
					t3(
						"[[upgrade.standard]]: €20 per month. Up to 50 users; everything of Free plus [[upgrade.company]], [[upgrade.collab]] and [[upgrade.multiFirm]]; 2000 MB of storage.",
						"[[upgrade.standard]]: 20 € pro Monat. Bis zu 50 Benutzer; alles aus Free plus [[upgrade.company]], [[upgrade.collab]] und [[upgrade.multiFirm]]; 2000 MB Speicher.",
						"[[upgrade.standard]]: €20 на місяць. До 50 користувачів; усе з Free плюс [[upgrade.company]], [[upgrade.collab]] та [[upgrade.multiFirm]]; 2000 МБ сховища.",
					),
					t3(
						"[[upgrade.professional]]: €53 per month. Unlimited users; all sections, including [[upgrade.documents]], [[upgrade.channels]], [[upgrade.mail]], [[upgrade.inventory]], [[upgrade.automation]], [[upgrade.aiAssistant]], [[upgrade.marketing]], [[upgrade.ads]] and [[upgrade.aiAutomation]]; 10 GB of storage. The card carries the line “[[upgrade.fullAccess]]”.",
						"[[upgrade.professional]]: 53 € pro Monat. Unbegrenzt viele Benutzer; alle Bereiche, einschließlich [[upgrade.documents]], [[upgrade.channels]], [[upgrade.mail]], [[upgrade.inventory]], [[upgrade.automation]], [[upgrade.aiAssistant]], [[upgrade.marketing]], [[upgrade.ads]] und [[upgrade.aiAutomation]]; 10 GB Speicher. Die Karte trägt die Zeile „[[upgrade.fullAccess]]“.",
						"[[upgrade.professional]]: €53 на місяць. Необмежена кількість користувачів; усі розділи, зокрема [[upgrade.documents]], [[upgrade.channels]], [[upgrade.mail]], [[upgrade.inventory]], [[upgrade.automation]], [[upgrade.aiAssistant]], [[upgrade.marketing]], [[upgrade.ads]] та [[upgrade.aiAutomation]]; 10 ГБ сховища. Картка має рядок «[[upgrade.fullAccess]]».",
					),
					t3(
						"The limits of the card (“rules · AI requests/day · storage”) are written on the card itself. Note: the Standard card mentions automation rules and AI requests, but automation and the AI assistant are part of Professional, so those two limits only matter there.",
						"Die Grenzen der Karte („Regeln · KI-Anfragen/Tag · Speicher“) stehen auf der Karte selbst. Beachten Sie: Die Standard-Karte nennt Automatisierungsregeln und KI-Anfragen, aber Automatisierung und der KI-Assistent gehören zu Professional, diese beiden Grenzen zählen also nur dort.",
						"Ліміти картки («правила · запити до ШІ/день · сховище») написано на самій картці. Зверніть увагу: картка Standard згадує правила автоматизації та запити до ШІ, але автоматизація й ШІ-асистент входять у Professional, тож ці два ліміти мають значення лише там.",
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
						"Above the cards a notice may appear. Orange: you came from a locked section — “… is not included in your current plan. Please change your plan first.” with the name of that section. The text [[upgrade.pastDue]] means the last payment failed; open [[upgrade.manageBilling]] and update the payment method. The text [[upgrade.paymentsNotConfigured]] means online payment is not set up on this site: the purchase buttons are then inactive.",
						"Über den Karten kann ein Hinweis erscheinen. Orange: Sie kamen aus einem gesperrten Bereich — „… ist in Ihrem aktuellen Tarif nicht enthalten. Bitte ändern Sie zuerst Ihren Tarif.“ mit dem Namen dieses Bereichs. Der Text [[upgrade.pastDue]] bedeutet, dass die letzte Zahlung fehlgeschlagen ist; öffnen Sie [[upgrade.manageBilling]] und aktualisieren Sie die Zahlungsmethode. Der Text [[upgrade.paymentsNotConfigured]] bedeutet, dass die Online-Zahlung auf dieser Website nicht eingerichtet ist: Die Kaufschaltflächen sind dann inaktiv.",
						"Над картками може з’явитися повідомлення. Помаранчеве: ви прийшли із заблокованого розділу — «… не входить у ваш поточний тариф. Спершу змініть тариф.» з назвою цього розділу. Текст [[upgrade.pastDue]] означає, що останній платіж не пройшов; відкрийте [[upgrade.manageBilling]] і оновіть спосіб оплати. Текст [[upgrade.paymentsNotConfigured]] означає, що онлайн-оплату на цьому сайті не налаштовано: кнопки купівлі тоді неактивні.",
					),
					t3(
						"Three cards stand in a row: [[upgrade.free]], [[upgrade.standard]], [[upgrade.professional]]. Each shows an icon, the name, the price, “Up to N users” (or [[upgrade.unlimitedUsers]]), the line with limits and the list of all fourteen features: what is included has a green tick, what is not is grey and struck through. The card of your current plan has a green border and a chip [[upgrade.currentPlan]].",
						"Drei Karten stehen in einer Reihe: [[upgrade.free]], [[upgrade.standard]], [[upgrade.professional]]. Jede zeigt ein Symbol, den Namen, den Preis, „Bis zu N Benutzer“ (oder [[upgrade.unlimitedUsers]]), die Zeile mit den Grenzen und die Liste aller vierzehn Funktionen: Was enthalten ist, hat ein grünes Häkchen, was nicht, ist grau und durchgestrichen. Die Karte Ihres aktuellen Tarifs hat einen grünen Rand und einen Chip [[upgrade.currentPlan]].",
						"Три картки стоять у ряд: [[upgrade.free]], [[upgrade.standard]], [[upgrade.professional]]. Кожна показує значок, назву, ціну, «До N користувачів» (або [[upgrade.unlimitedUsers]]), рядок із лімітами й перелік усіх чотирнадцяти функцій: що входить — має зелену галочку, що ні — сіре й закреслене. Картка вашого поточного тарифу має зелену рамку та чип [[upgrade.currentPlan]].",
					),
					t3(
						"On the current paid card a line under the price tells how long the plan runs: “Renews on <date>” (a subscription that renews), “Ends on <date>” (a subscription that was cancelled and runs to the end of the paid period) or “Active until <date> (paid in advance)” (a plan paid by crypto or assigned by the platform team).",
						"Auf der aktuellen bezahlten Karte sagt eine Zeile unter dem Preis, wie lange der Tarif läuft: „Verlängert sich am <Datum>“ (ein Abonnement, das sich verlängert), „Endet am <Datum>“ (ein gekündigtes Abonnement, das bis zum Ende des bezahlten Zeitraums läuft) oder „Aktiv bis <Datum> (im Voraus bezahlt)“ (ein per Krypto bezahlter oder vom Plattform-Team zugewiesener Tarif).",
						"На поточній платній картці рядок під ціною каже, як довго діє тариф: «Поновлюється <дата>» (підписка, що поновлюється), «Закінчується <дата>» (скасована підписка, що діє до кінця оплаченого періоду) або «Активний до <дата> (оплачено наперед)» (тариф, оплачений криптою або призначений командою платформи).",
					),
				],
			},
			{
				title: t3("Buying and changing the plan", "Tarif kaufen und ändern", "Купівля й зміна тарифу"),
				steps: [
					t3(
						"The button on a card depends on the state. Free card: [[upgrade.currentPlan]] (inactive) while you are on Free; otherwise [[upgrade.manageBilling]] (you go back to Free by cancelling the subscription in the Stripe portal). A paid card without a subscription: [[upgrade.buy]]. A paid card that is your current one, with a subscription: [[upgrade.manageBilling]]. Another paid card, while you have a subscription: [[upgrade.changePlan]].",
						"Die Schaltfläche auf einer Karte hängt vom Zustand ab. Free-Karte: [[upgrade.currentPlan]] (inaktiv), solange Sie auf Free sind; sonst [[upgrade.manageBilling]] (zu Free kommen Sie zurück, indem Sie das Abonnement im Stripe-Portal kündigen). Eine bezahlte Karte ohne Abonnement: [[upgrade.buy]]. Eine bezahlte Karte, die Ihre aktuelle ist, mit Abonnement: [[upgrade.manageBilling]]. Eine andere bezahlte Karte, solange Sie ein Abonnement haben: [[upgrade.changePlan]].",
						"Кнопка на картці залежить від стану. Картка Free: [[upgrade.currentPlan]] (неактивна), поки ви на Free; інакше [[upgrade.manageBilling]] (повернутися на Free можна, скасувавши підписку в порталі Stripe). Платна картка без підписки: [[upgrade.buy]]. Платна картка, що є вашою поточною, з підпискою: [[upgrade.manageBilling]]. Інша платна картка, поки у вас є підписка: [[upgrade.changePlan]].",
					),
					t3(
						"Buying by card: choose the period, then press [[upgrade.buy]] on the plan you want. The button is inactive while the request runs or if payments are not configured. You are taken to the secure payment page of Stripe (in your language; the price in euros, a promotion code can be entered there). Pay there. Under the cards the line “[[upgrade.securePayment]]” reminds that the card details never reach Firmspace.",
						"Kauf per Karte: Wählen Sie den Zeitraum und drücken Sie dann [[upgrade.buy]] beim gewünschten Tarif. Die Schaltfläche ist inaktiv, solange die Anfrage läuft oder wenn Zahlungen nicht eingerichtet sind. Sie werden zur sicheren Zahlungsseite von Stripe geleitet (in Ihrer Sprache; der Preis in Euro, ein Aktionscode kann dort eingegeben werden). Bezahlen Sie dort. Unter den Karten erinnert die Zeile „[[upgrade.securePayment]]“ daran, dass die Kartendaten nie zu Firmspace gelangen.",
						"Купівля карткою: оберіть період, потім натисніть [[upgrade.buy]] на потрібному тарифі. Кнопка неактивна, поки триває запит або якщо платежі не налаштовано. Вас переводить на захищену сторінку оплати Stripe (вашою мовою; ціна в євро, там можна ввести промокод). Оплатіть там. Під картками рядок «[[upgrade.securePayment]]» нагадує, що дані картки ніколи не потрапляють у Firmspace.",
					),
					t3(
						"When you come back, you land on the same page with a message: “[[upgrade.checkoutSuccess]]” (the CRM has asked Stripe and the plan is already on), “[[upgrade.checkoutPending]]” (the confirmation is still on its way; the plan switches on in a moment) or, if you closed the payment, “[[upgrade.checkoutCancel]]”. If the payment page could not be opened you see “[[upgrade.checkoutFailed]]”. If a subscription already exists, the message “[[upgrade.alreadySubscribed]]” tells you to use [[upgrade.manageBilling]] instead.",
						"Wenn Sie zurückkommen, landen Sie auf derselben Seite mit einer Meldung: „[[upgrade.checkoutSuccess]]“ (das CRM hat Stripe gefragt, und der Tarif ist schon aktiv), „[[upgrade.checkoutPending]]“ (die Bestätigung ist noch unterwegs; der Tarif wird gleich aktiv) oder, wenn Sie die Zahlung geschlossen haben, „[[upgrade.checkoutCancel]]“. Konnte die Zahlungsseite nicht geöffnet werden, sehen Sie „[[upgrade.checkoutFailed]]“. Besteht bereits ein Abonnement, sagt die Meldung „[[upgrade.alreadySubscribed]]“, dass Sie stattdessen [[upgrade.manageBilling]] nutzen sollen.",
						"Коли ви повертаєтесь, потрапляєте на ту саму сторінку з повідомленням: «[[upgrade.checkoutSuccess]]» (CRM запитала Stripe, і тариф уже діє), «[[upgrade.checkoutPending]]» (підтвердження ще в дорозі; тариф увімкнеться за мить) або, якщо ви закрили оплату, «[[upgrade.checkoutCancel]]». Якщо сторінку оплати відкрити не вдалося, ви бачите «[[upgrade.checkoutFailed]]». Якщо підписка вже існує, повідомлення «[[upgrade.alreadySubscribed]]» каже користуватися [[upgrade.manageBilling]].",
					),
					t3(
						"If you registered from the price list of the public website by pressing a plan there, the CRM starts this same payment for that plan and period by itself right after registration — you do not have to press [[upgrade.buy]] again.",
						"Haben Sie sich über die Preisliste der öffentlichen Website durch Drücken eines Tarifs registriert, startet das CRM gleich nach der Registrierung dieselbe Zahlung für diesen Tarif und Zeitraum von selbst — Sie müssen [[upgrade.buy]] nicht noch einmal drücken.",
						"Якщо ви зареєструвалися з прайсу публічного сайту, натиснувши там тариф, CRM одразу після реєстрації сама запускає ту саму оплату для цього тарифу й періоду — вам не треба знову натискати [[upgrade.buy]].",
					),
					t3(
						"[[upgrade.manageBilling]] and [[upgrade.changePlan]] open the Stripe portal. There you change the plan, change the payment method, download invoices and cancel the subscription; a button in the portal returns you to this page. If Stripe has no customer record for the firm yet, the message says that there is no subscription yet.",
						"[[upgrade.manageBilling]] und [[upgrade.changePlan]] öffnen das Stripe-Portal. Dort ändern Sie den Tarif, ändern die Zahlungsmethode, laden Rechnungen herunter und kündigen das Abonnement; eine Schaltfläche im Portal bringt Sie zu dieser Seite zurück. Hat Stripe noch keinen Kundeneintrag für die Firma, sagt die Meldung, dass es noch kein Abonnement gibt.",
						"[[upgrade.manageBilling]] і [[upgrade.changePlan]] відкривають портал Stripe. Там ви змінюєте тариф, змінюєте спосіб оплати, завантажуєте рахунки й скасовуєте підписку; кнопка в порталі повертає вас на цю сторінку. Якщо в Stripe ще немає запису клієнта для фірми, повідомлення каже, що підписки ще немає.",
					),
					t3(
						"What happens later: while a payment is being retried after a failure, the plan stays on (with the notice above). When a subscription ends or is cancelled, the firm returns to Free at the end of the paid period; nothing is deleted, but sections that are no longer in the plan are locked.",
						"Was später passiert: Solange eine fehlgeschlagene Zahlung erneut versucht wird, bleibt der Tarif aktiv (mit dem Hinweis oben). Endet ein Abonnement oder wird es gekündigt, fällt die Firma am Ende des bezahlten Zeitraums auf Free zurück; nichts wird gelöscht, aber Bereiche, die nicht mehr im Tarif sind, werden gesperrt.",
						"Що буде далі: поки невдалий платіж повторюється, тариф лишається ввімкненим (із повідомленням угорі). Коли підписка закінчується чи скасована, фірма повертається на Free наприкінці оплаченого періоду; нічого не видаляється, але розділи, яких більше немає в тарифі, блокуються.",
					),
				],
			},
			{
				title: t3("Other ways to pay: crypto and invoice", "Andere Zahlungswege: Krypto und Rechnung", "Інші способи оплати: крипта й рахунок"),
				steps: [
					t3(
						"Under the cards the block [[upgrade.methods]] shows the icons of the methods (Visa, Mastercard, Apple Pay, Google Pay, PayPal, Klarna, SEPA). Which ones you can really use is shown on the payment page of Stripe; the text under the icons repeats it.",
						"Unter den Karten zeigt der Block [[upgrade.methods]] die Symbole der Zahlungsarten (Visa, Mastercard, Apple Pay, Google Pay, PayPal, Klarna, SEPA). Welche Sie tatsächlich nutzen können, zeigt die Zahlungsseite von Stripe; der Text unter den Symbolen wiederholt das.",
						"Під картками блок [[upgrade.methods]] показує значки способів оплати (Visa, Mastercard, Apple Pay, Google Pay, PayPal, Klarna, SEPA). Які з них справді можна використати, показує сторінка оплати Stripe; текст під значками це повторює.",
					),
					t3(
						"Crypto: if the site has crypto payments switched on and you have no active card subscription, a link [[upgrade.payCrypto]] appears. It opens a payment for one month or twelve months. This is a single payment, not a subscription — it does not renew by itself. After paying you return with “[[upgrade.cryptoPending]]”; the plan switches on when the blockchain confirms the payment, and the card shows “Active until <date> (paid in advance)”. If it is not switched on, you see “[[upgrade.cryptoNotConfigured]]”.",
						"Krypto: Hat die Website Krypto-Zahlungen eingeschaltet und Sie haben kein aktives Kartenabonnement, erscheint ein Link [[upgrade.payCrypto]]. Er öffnet eine Zahlung für einen Monat oder zwölf Monate. Das ist eine Einmalzahlung, kein Abonnement — sie verlängert sich nicht von selbst. Nach dem Bezahlen kehren Sie mit „[[upgrade.cryptoPending]]“ zurück; der Tarif wird aktiv, wenn die Blockchain die Zahlung bestätigt, und die Karte zeigt „Aktiv bis <Datum> (im Voraus bezahlt)“. Ist sie nicht eingeschaltet, sehen Sie „[[upgrade.cryptoNotConfigured]]“.",
						"Крипта: якщо на сайті ввімкнено криптоплатежі, а активної підписки карткою у вас немає, з’являється посилання [[upgrade.payCrypto]]. Воно відкриває оплату на один місяць або дванадцять місяців. Це разовий платіж, а не підписка — сам він не поновлюється. Після оплати ви повертаєтесь із «[[upgrade.cryptoPending]]»; тариф вмикається, коли блокчейн підтвердить платіж, а картка показує «Активний до <дата> (оплачено наперед)». Якщо не ввімкнено, ви бачите «[[upgrade.cryptoNotConfigured]]».",
					),
					t3(
						"Bank transfer: the button [[upgrade.invoiceButton]] opens a window with the text “[[upgrade.invoiceText]]”. Choose the plan in the list [[upgrade.planLabel]] (the price for the chosen period is shown next to each), fill in [[upgrade.invoiceCompany]] (required, up to 200 characters) and [[upgrade.invoiceVat]] (optional, up to 40 characters) and press [[upgrade.invoiceSend]] (or [[upgrade.cancel]]). You see “[[upgrade.invoiceSent]]”. A second request while one is open gives “[[upgrade.invoiceOpen]]”.",
						"Banküberweisung: Die Schaltfläche [[upgrade.invoiceButton]] öffnet ein Fenster mit dem Text „[[upgrade.invoiceText]]“. Wählen Sie den Tarif in der Liste [[upgrade.planLabel]] (neben jedem steht der Preis für den gewählten Zeitraum), füllen Sie [[upgrade.invoiceCompany]] (Pflicht, bis 200 Zeichen) und [[upgrade.invoiceVat]] (optional, bis 40 Zeichen) aus und drücken Sie [[upgrade.invoiceSend]] (oder [[upgrade.cancel]]). Sie sehen „[[upgrade.invoiceSent]]“. Eine zweite Anfrage, solange eine offen ist, ergibt „[[upgrade.invoiceOpen]]“.",
						"Банківський переказ: кнопка [[upgrade.invoiceButton]] відкриває вікно з текстом «[[upgrade.invoiceText]]». Оберіть тариф у списку [[upgrade.planLabel]] (поруч із кожним показано ціну для вибраного періоду), заповніть [[upgrade.invoiceCompany]] (обов’язково, до 200 символів) і [[upgrade.invoiceVat]] (необов’язково, до 40 символів) і натисніть [[upgrade.invoiceSend]] (або [[upgrade.cancel]]). Ви бачите «[[upgrade.invoiceSent]]». Другий запит, поки один відкритий, дає «[[upgrade.invoiceOpen]]».",
					),
					t3(
						"Important about the invoice: the request is only recorded in the system. The Firmspace team handles it manually — the invoice is sent to you by e-mail and the plan is switched on by hand when the payment arrives, which takes longer than a card payment.",
						"Wichtig zur Rechnung: Die Anfrage wird nur im System vermerkt. Das Firmspace-Team bearbeitet sie manuell — die Rechnung wird Ihnen per E-Mail geschickt, und der Tarif wird von Hand eingeschaltet, wenn die Zahlung eingeht, was länger dauert als eine Kartenzahlung.",
						"Важливо про рахунок: запит лише фіксується в системі. Команда Firmspace опрацьовує його вручну — рахунок надсилають вам електронною поштою, а тариф вмикають уручну, коли надходить оплата, що триває довше, ніж оплата карткою.",
					),
					t3(
						"The platform team can also assign a plan to a firm directly (for example for a trial or a partner). Such an assignment has priority over a subscription and is shown as “Active until <date>” when it has an end date.",
						"Das Plattform-Team kann einer Firma einen Tarif auch direkt zuweisen (zum Beispiel für einen Test oder einen Partner). Eine solche Zuweisung hat Vorrang vor einem Abonnement und wird als „Aktiv bis <Datum>“ gezeigt, wenn sie ein Enddatum hat.",
						"Команда платформи може також призначити фірмі тариф напряму (наприклад, для тесту чи партнера). Таке призначення має пріоритет над підпискою й показується як «Активний до <дата>», якщо має дату закінчення.",
					),
				],
			},
		],
	},
];
