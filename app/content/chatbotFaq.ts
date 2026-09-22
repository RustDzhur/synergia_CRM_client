import { t3, Tx } from "./i18n";

// База знаний лендингового чат-бота: отвечает ТОЛЬКО по этим готовым текстам, без обращений к языковой модели —
// осознанный выбор (см. память проекта): публичный бот без авторизации — другой профиль злоупотребления/стоимости,
// чем внутренний Firmspace AI внутри CRM. lib/chatbotMatch.ts подбирает запись по совпадению keywords (ключевые слова
// на всех трёх языках, не показываются пользователю — только для поиска) с текстом вопроса.
export interface FaqEntry { id: string; q: Tx; a: Tx; keywords: string[] }

export const CHATBOT_FAQ: FaqEntry[] = [
	{
		id: "what_is",
		q: t3("What is Firmspace CRM?", "Was ist Firmspace CRM?", "Що таке Firmspace CRM?"),
		a: t3(
			"Firmspace CRM is an all-in-one platform for customer relationships: deals pipeline, contacts and companies, tasks and calendar, a unified inbox for chat and calls, web mail, marketing tools, accounting (quotes, orders, invoices, contracts) and an AI assistant — all in one place.",
			"Firmspace CRM ist eine All-in-one-Plattform für Kundenbeziehungen: Deal-Pipeline, Kontakte und Firmen, Aufgaben und Kalender, ein einheitlicher Posteingang für Chat und Anrufe, Web-Mail, Marketing-Tools, Buchhaltung (Angebote, Aufträge, Rechnungen, Verträge) und ein KI-Assistent — alles an einem Ort.",
			"Firmspace CRM — платформа «все в одному» для роботи з клієнтами: воронка угод, контакти й компанії, завдання та календар, єдина скринька для чатів і дзвінків, веб-пошта, маркетингові інструменти, бухгалтерія (пропозиції, замовлення, рахунки, договори) та AI-асистент — усе в одному місці."
		),
		keywords: ["what does firmspace", "tell me about", "about this platform", "what platform", "was ist firmspace", "über firmspace", "plattform ist das", "що таке firmspace", "що це за платформа"],
	},
	{
		id: "pricing",
		q: t3("How much does it cost?", "Was kostet es?", "Скільки це коштує?"),
		a: t3(
			"There are three plans: Free (up to 5 users, core CRM), Standard (€20/month, up to 50 users, adds Ads performance) and Professional (€35/month, unlimited users, adds the autonomous AI automation step and the highest limits). Paying yearly gives you 2 months free. See the exact feature list under Choose Plan on this page.",
			"Es gibt drei Tarife: Free (bis 5 Benutzer, Kern-CRM), Standard (20 €/Monat, bis 50 Benutzer, plus Ad-Performance) und Professional (35 €/Monat, unbegrenzte Benutzer, plus autonomer KI-Automatisierungsschritt und die höchsten Limits). Bei jährlicher Zahlung erhalten Sie 2 Monate gratis. Die genaue Funktionsliste finden Sie unter Choose Plan auf dieser Seite.",
			"Є три тарифи: Free (до 5 користувачів, базовий CRM), Standard (20 €/міс, до 50 користувачів, плюс ефективність реклами) і Professional (35 €/міс, необмежена кількість користувачів, плюс автономний крок AI-автоматизації та найвищі ліміти). При річній оплаті — 2 місяці безкоштовно. Повний список функцій — у розділі Choose Plan на цій сторінці."
		),
		keywords: ["price", "cost", "pricing", "plan", "tariff", "subscription", "how much", "preis", "kosten", "tarif", "abo", "ціна", "тариф", "вартість", "план", "підписка"],
	},
	{
		id: "free_trial",
		q: t3("Is there a free plan or trial?", "Gibt es einen kostenlosen Tarif oder eine Testphase?", "Чи є безкоштовний тариф або пробний період?"),
		a: t3(
			"Yes — the Free plan is free forever for up to 5 users, with the core CRM (deals, contacts, tasks, feed, calendar, web mail, automation). No credit card is needed to sign up.",
			"Ja — der Free-Tarif ist dauerhaft kostenlos für bis zu 5 Benutzer, mit dem Kern-CRM (Deals, Kontakte, Aufgaben, Feed, Kalender, Web-Mail, Automatisierung). Für die Registrierung ist keine Kreditkarte nötig.",
			"Так — тариф Free безкоштовний назавжди для до 5 користувачів, із базовим CRM (угоди, контакти, завдання, стрічка, календар, веб-пошта, автоматизація). Кредитна картка для реєстрації не потрібна."
		),
		keywords: ["free", "trial", "demo", "no cost", "kostenlos", "test", "gratis", "безкоштовн", "пробн", "демо"],
	},
	{
		id: "signup",
		q: t3("How do I sign up?", "Wie melde ich mich an?", "Як зареєструватися?"),
		a: t3(
			"Press Sign Up (top right), choose Company or Personal, fill in the short form and submit. You can start using the CRM right after signing in.",
			"Klicken Sie oben rechts auf Sign Up, wählen Sie Company oder Personal, füllen Sie das kurze Formular aus und senden Sie es ab. Nach der Anmeldung können Sie das CRM sofort nutzen.",
			"Натисніть Sign Up (справа вгорі), оберіть Company або Personal, заповніть коротку форму й надішліть. Одразу після входу можна користуватися CRM."
		),
		keywords: ["sign up", "register", "create account", "get started", "registrieren", "konto erstellen", "anmelden", "зареєстр", "створити акаунт", "почати"],
	},
	{
		id: "finance",
		q: t3("Can it handle invoices and accounting?", "Kann es Rechnungen und Buchhaltung verwalten?", "Чи вміє система виставляти рахунки й вести бухгалтерію?"),
		a: t3(
			"Yes. The Finance section covers quotes, orders, invoices (with automatic overdue tracking), contracts, products with stock tracking, and expenses — with tax rates set automatically from your country. See Documentation → Finance for the full workflow.",
			"Ja. Der Bereich Finance umfasst Angebote, Aufträge, Rechnungen (mit automatischer Überfälligkeitsverfolgung), Verträge, Produkte mit Bestandsverwaltung und Ausgaben — mit automatisch nach Ihrem Land gesetzten Steuersätzen. Den vollständigen Ablauf finden Sie unter Documentation → Finance.",
			"Так. Розділ Finance охоплює пропозиції, замовлення, рахунки (з автоматичним відстеженням прострочення), договори, товари з обліком залишків і витрати — податкові ставки визначаються автоматично за вашою країною. Повний процес описано в Documentation → Finance."
		),
		keywords: ["invoice", "invoicing", "accounting", "bookkeeping", "quote", "contract", "tax", "vat", "rechnung", "buchhaltung", "angebot", "vertrag", "steuer", "рахунок", "бухгалтер", "пропозиц", "договір", "податок"],
	},
	{
		id: "ai_assistant",
		q: t3("Does it have an AI assistant?", "Gibt es einen KI-Assistenten?", "Чи є AI-асистент?"),
		a: t3(
			"Yes, Firmspace AI is built in: it can look up your customers, tasks and employees, read attached PDFs, and summarize deals — and it always asks for confirmation before changing anything.",
			"Ja, Firmspace AI ist integriert: Sie kann Kunden, Aufgaben und Mitarbeitende nachschlagen, angehängte PDFs lesen und Deals zusammenfassen — und fragt vor jeder Änderung immer erst nach Bestätigung.",
			"Так, Firmspace AI вбудований: може шукати ваших клієнтів, завдання й співробітників, читати прикріплені PDF і робити стислий опис угод — і завжди питає підтвердження перед будь-якою зміною."
		),
		keywords: ["ai", "assistant", "chatbot", "artificial intelligence", "ki", "assistent", "künstliche intelligenz", "асистент", "штучний інтелект", "бот"],
	},
	{
		id: "automation",
		q: t3("Can I automate my workflow?", "Kann ich meinen Workflow automatisieren?", "Чи можна автоматизувати робочі процеси?"),
		a: t3(
			"Yes — Automation rules react to events (a deal is created, an order changes status, an invoice is paid, and more) with an action: notify, create a task, send an e-mail, move a pipeline stage, call a webhook, or let the AI decide.",
			"Ja — Automatisierungsregeln reagieren auf Ereignisse (ein Deal wird erstellt, ein Auftrag ändert den Status, eine Rechnung wird bezahlt u. v. m.) mit einer Aktion: benachrichtigen, eine Aufgabe erstellen, eine E-Mail senden, eine Pipeline-Phase wechseln, einen Webhook aufrufen oder die KI entscheiden lassen.",
			"Так — правила автоматизації реагують на події (створено угоду, замовлення змінило статус, рахунок оплачено й інші) дією: сповістити, створити завдання, надіслати e-mail, перемістити етап воронки, викликати webhook або дати вирішити AI."
		),
		keywords: ["automation", "automate", "workflow", "rules", "trigger", "automatisierung", "workflow", "regeln", "автоматизац", "правил", "процес"],
	},
	{
		id: "channels",
		q: t3("Which channels can I connect?", "Welche Kanäle kann ich verbinden?", "Які канали можна підключити?"),
		a: t3(
			"Telegram, Viber, Messenger, SMS/calls via Twilio, website chat and mailboxes (Gmail, Outlook, iCloud, Yahoo or any IMAP account) — all answered from one unified inbox.",
			"Telegram, Viber, Messenger, SMS/Anrufe über Twilio, Website-Chat und Postfächer (Gmail, Outlook, iCloud, Yahoo oder jedes IMAP-Konto) — alle aus einem einheitlichen Posteingang beantwortet.",
			"Telegram, Viber, Messenger, SMS/дзвінки через Twilio, чат сайту й поштові скриньки (Gmail, Outlook, iCloud, Yahoo чи будь-який IMAP-акаунт) — усе з єдиної скриньки."
		),
		keywords: ["telegram", "viber", "messenger", "whatsapp", "sms", "calls", "phone", "mail", "email", "channel", "integration", "kanal", "integration", "канал", "інтеграц", "телефон", "пошта"],
	},
	{
		id: "security",
		q: t3("Is my data safe and GDPR-compliant?", "Sind meine Daten sicher und DSGVO-konform?", "Чи безпечні мої дані та чи відповідає це GDPR?"),
		a: t3(
			"Data is transferred over HTTPS, passwords are hashed, and access keys of connected services are stored encrypted. See our Privacy policy for the full details, and Legal notice / Terms for the company's legal information.",
			"Daten werden über HTTPS übertragen, Passwörter gehasht, und Zugangsschlüssel verbundener Dienste verschlüsselt gespeichert. Details finden Sie in unserer Datenschutzerklärung, rechtliche Angaben im Impressum / in den AGB.",
			"Дані передаються через HTTPS, паролі хешуються, а ключі доступу підключених сервісів зберігаються зашифрованими. Деталі — у нашій Політиці конфіденційності, юридична інформація — у Impressum / AGB."
		),
		keywords: ["security", "safe", "gdpr", "dsgvo", "data protection", "privacy", "encrypted", "sicherheit", "datenschutz", "verschlüsselt", "безпек", "захист даних", "приватність"],
	},
	{
		id: "cancel",
		q: t3("Can I change or cancel my plan?", "Kann ich meinen Tarif ändern oder kündigen?", "Чи можна змінити або скасувати тариф?"),
		a: t3(
			"Yes, any time from Upgrade Your Plan inside the CRM. The change applies from the next billing period, and you keep access until the end of the period you already paid for.",
			"Ja, jederzeit unter Upgrade Your Plan im CRM. Die Änderung gilt ab der nächsten Abrechnungsperiode, und der Zugang bleibt bis zum Ende des bereits bezahlten Zeitraums bestehen.",
			"Так, будь-коли в розділі Upgrade Your Plan усередині CRM. Зміна діє з наступного розрахункового періоду, а доступ зберігається до кінця вже оплаченого періоду."
		),
		keywords: ["cancel", "downgrade", "upgrade", "change plan", "kündigen", "wechseln", "скасувати", "змінити тариф"],
	},
	{
		id: "team",
		q: t3("Can I add my team and set permissions?", "Kann ich mein Team hinzufügen und Berechtigungen festlegen?", "Чи можна додати команду й налаштувати права доступу?"),
		a: t3(
			"Yes — invite colleagues in Settings → Colleagues and assign a role (admin, manager, employee, viewer), plus, if needed, exactly which sections each person can access.",
			"Ja — laden Sie Kollegen unter Settings → Colleagues ein und weisen Sie eine Rolle zu (Admin, Manager, Mitarbeiter, Betrachter) sowie bei Bedarf genau die Bereiche, auf die die Person zugreifen darf.",
			"Так — запрошуйте колег у Settings → Colleagues і призначайте роль (admin, manager, employee, viewer), а за потреби — точно ті розділи, до яких людина матиме доступ."
		),
		keywords: ["team", "colleagues", "members", "roles", "permissions", "users", "team", "kollegen", "rollen", "berechtigungen", "команда", "колег", "ролі", "права"],
	},
	{
		id: "mobile",
		q: t3("Does it work on mobile?", "Funktioniert es auf dem Smartphone?", "Чи працює на телефоні?"),
		a: t3(
			"Yes, the interface adapts to phones and tablets, and calls and chats work right in the mobile browser — no app install needed.",
			"Ja, die Oberfläche passt sich Smartphones und Tablets an, und Anrufe sowie Chats funktionieren direkt im mobilen Browser — keine App-Installation nötig.",
			"Так, інтерфейс адаптується до телефонів і планшетів, а дзвінки й чати працюють прямо в мобільному браузері — встановлювати застосунок не потрібно."
		),
		keywords: ["mobile", "phone", "app", "tablet", "smartphone", "handy", "app", "телефон", "мобільн", "застосунок"],
	},
	{
		id: "support",
		q: t3("How do I reach support?", "Wie erreiche ich den Support?", "Як звернутися в підтримку?"),
		a: t3(
			"Open the Support / FAQ page and use Contact support, or write to us from the Contact page. We reply within one business day.",
			"Öffnen Sie die Seite Support / FAQ und nutzen Sie Support kontaktieren, oder schreiben Sie uns über die Kontaktseite. Wir antworten innerhalb eines Werktags.",
			"Відкрийте сторінку Support / FAQ і скористайтеся Contact support, або напишіть нам зі сторінки Contact. Ми відповідаємо протягом одного робочого дня."
		),
		keywords: ["support", "help", "contact", "human", "real person", "hilfe", "kontakt", "support", "допомог", "контакт", "підтримк"],
	},
];
