import { t3 } from "./i18n";

// ── Team ─────────────────────────────────────────────────────────────────────
export const TEAM = {
	title: t3("Our Team", "Unser Team", "Наша команда"),
	intro: t3("A small team of engineers, designers and support specialists who build Firmspace AI and answer your questions every day.", "Ein kleines Team aus Entwicklern, Designern und Support-Spezialisten, das Firmspace AI baut und täglich Ihre Fragen beantwortet.", "Невелика команда інженерів, дизайнерів і спеціалістів підтримки, які створюють Firmspace AI і щодня відповідають на ваші запитання."),
	members: [
		{ name: "Anna Keller", role: t3("CEO & Co-founder", "CEO & Mitgründerin", "CEO та співзасновниця"), bio: t3("Builds the vision and makes sure we solve real problems of small companies.", "Entwickelt die Vision und sorgt dafür, dass wir echte Probleme kleiner Unternehmen lösen.", "Формує бачення й стежить, щоб ми розв’язували реальні проблеми малого бізнесу.") },
		{ name: "Oleksandr Shevchenko", role: t3("CTO", "CTO", "Технічний директор"), bio: t3("Leads the platform architecture: performance, security and integrations.", "Verantwortet die Plattformarchitektur: Leistung, Sicherheit und Integrationen.", "Керує архітектурою платформи: продуктивність, безпека та інтеграції.") },
		{ name: "Lena Fischer", role: t3("Head of Design", "Leiterin Design", "Керівниця дизайну"), bio: t3("Makes complex workflows feel simple on every screen size.", "Macht komplexe Abläufe auf jeder Bildschirmgröße einfach.", "Робить складні процеси простими на екрані будь-якого розміру.") },
		{ name: "Maksym Bondar", role: t3("Senior Engineer", "Senior Engineer", "Провідний інженер"), bio: t3("Works on real-time messaging, telephony and mail synchronization.", "Arbeitet an Echtzeit-Messaging, Telefonie und E-Mail-Synchronisation.", "Працює над обміном повідомленнями, телефонією та синхронізацією пошти.") },
		{ name: "Sophie Wagner", role: t3("Customer Success", "Customer Success", "Успіх клієнтів"), bio: t3("Helps teams get started and get the most out of the CRM.", "Hilft Teams beim Einstieg und dabei, das Beste aus dem CRM herauszuholen.", "Допомагає командам почати роботу й отримати максимум від CRM.") },
		{ name: "Iryna Melnyk", role: t3("Marketing Lead", "Marketing-Leiterin", "Керівниця маркетингу"), bio: t3("Tells the story of Firmspace AI and listens to what customers need.", "Erzählt die Geschichte von Firmspace AI und hört zu, was Kunden brauchen.", "Розповідає історію Firmspace AI і слухає, що потрібно клієнтам.") },
	],
};

// ── Careers ──────────────────────────────────────────────────────────────────
export const CAREERS = {
	title: t3("Careers", "Karriere", "Кар’єра"),
	intro: t3("We are growing. Join a friendly remote-first team and help thousands of companies work better with their customers.", "Wir wachsen. Werden Sie Teil eines freundlichen Remote-first-Teams und helfen Sie tausenden Unternehmen, besser mit ihren Kunden zu arbeiten.", "Ми зростаємо. Приєднуйтесь до дружньої remote-first команди й допоможіть тисячам компаній краще працювати з клієнтами."),
	perksTitle: t3("Why work with us", "Warum bei uns arbeiten", "Чому варто працювати з нами"),
	perks: [
		t3("Remote-first with flexible hours", "Remote-first mit flexiblen Arbeitszeiten", "Remote-first із гнучким графіком"),
		t3("Learning budget and paid conferences", "Weiterbildungsbudget und bezahlte Konferenzen", "Бюджет на навчання та оплачувані конференції"),
		t3("30 days of paid vacation", "30 Tage bezahlter Urlaub", "30 днів оплачуваної відпустки"),
		t3("Modern stack: Next.js, TypeScript, MongoDB", "Moderner Stack: Next.js, TypeScript, MongoDB", "Сучасний стек: Next.js, TypeScript, MongoDB"),
	],
	openTitle: t3("Open positions", "Offene Stellen", "Відкриті вакансії"),
	apply: t3("Apply", "Bewerben", "Відгукнутися"),
	positions: [
		{ title: t3("Senior Frontend Engineer", "Senior Frontend Engineer", "Senior Frontend-інженер"), meta: t3("Remote · Full-time", "Remote · Vollzeit", "Віддалено · Повна зайнятість") },
		{ title: t3("Backend Engineer (Node.js)", "Backend Engineer (Node.js)", "Backend-інженер (Node.js)"), meta: t3("Remote · Full-time", "Remote · Vollzeit", "Віддалено · Повна зайнятість") },
		{ title: t3("Product Designer", "Product Designer", "Продуктовий дизайнер"), meta: t3("Berlin or remote · Full-time", "Berlin oder Remote · Vollzeit", "Берлін або віддалено · Повна зайнятість") },
		{ title: t3("Customer Support Specialist", "Customer Support Specialist", "Спеціаліст підтримки клієнтів"), meta: t3("Remote · Part-time", "Remote · Teilzeit", "Віддалено · Часткова зайнятість") },
	],
};

// ── Support / FAQ ────────────────────────────────────────────────────────────
export const SUPPORT = {
	title: t3("Support / FAQ", "Support / FAQ", "Підтримка / FAQ"),
	intro: t3("Answers to the questions we hear most often. Can't find yours? Write to us — we reply within one business day.", "Antworten auf die Fragen, die wir am häufigsten hören. Ihre ist nicht dabei? Schreiben Sie uns – wir antworten innerhalb eines Werktags.", "Відповіді на запитання, які ми чуємо найчастіше. Не знайшли своє? Напишіть нам — ми відповідаємо протягом одного робочого дня."),
	contactCta: t3("Contact support", "Support kontaktieren", "Написати в підтримку"),
	faq: [
		{ q: t3("How do I create an account?", "Wie erstelle ich ein Konto?", "Як створити акаунт?"), a: t3("Press Sign Up in the top right corner, choose Company or Personal, fill in the form and confirm. You can start using the CRM right away.", "Klicken Sie oben rechts auf Sign Up, wählen Sie Company oder Personal, füllen Sie das Formular aus und bestätigen Sie. Sie können das CRM sofort nutzen.", "Натисніть Sign Up у правому верхньому куті, оберіть Company або Personal, заповніть форму й підтвердіть. Користуватися CRM можна одразу.") },
		{ q: t3("Is there a free plan?", "Gibt es einen kostenlosen Tarif?", "Чи є безкоштовний тариф?"), a: t3("Yes, but a limited one: Free covers one user with the sales pipeline and tasks. Team features such as chat, calendar and the feed start with Standard at €20 a month (up to 50 users); Professional costs €53 a month and removes the user limit.", "Ja, aber eingeschränkt: Free deckt einen Benutzer mit Vertriebspipeline und Aufgaben ab. Teamfunktionen wie Chat, Kalender und Feed beginnen mit Standard für 20 € im Monat (bis zu 50 Benutzer); Professional kostet 53 € im Monat und hebt die Benutzergrenze auf.", "Так, але обмежений: Free покриває одного користувача з воронкою продажів і завданнями. Командні функції — чат, календар і стрічка — починаються з тарифу Standard за 20 € на місяць (до 50 користувачів); Professional коштує 53 € на місяць і знімає обмеження на кількість користувачів.") },
		{ q: t3("Can I change or cancel my plan?", "Kann ich meinen Tarif ändern oder kündigen?", "Чи можна змінити або скасувати тариф?"), a: t3("Yes, at any time in Upgrade Your Plan. The change applies from the next billing period.", "Ja, jederzeit unter Upgrade Your Plan. Die Änderung gilt ab der nächsten Abrechnungsperiode.", "Так, будь-коли в розділі Upgrade Your Plan. Зміна діє з наступного розрахункового періоду.") },
		{ q: t3("How do I connect Telegram, Viber or a phone number?", "Wie verbinde ich Telegram, Viber oder eine Telefonnummer?", "Як підключити Telegram, Viber або номер телефону?"), a: t3("Open Settings → Integration, choose the channel, enter the key from the provider and press Connect. Step-by-step guides are in the Documentation.", "Öffnen Sie Settings → Integration, wählen Sie den Kanal, geben Sie den Schlüssel des Anbieters ein und klicken Sie auf Connect. Schritt-für-Schritt-Anleitungen finden Sie in der Dokumentation.", "Відкрийте Settings → Integration, оберіть канал, введіть ключ від провайдера й натисніть Connect. Покрокові інструкції — у Документації.") },
		{ q: t3("My mailbox will not connect. What should I do?", "Mein Postfach lässt sich nicht verbinden. Was tun?", "Скринька не підключається. Що робити?"), a: t3("Gmail, iCloud and Yahoo need an app password instead of your account password. Create one in your account security settings and use it in Web Mails.", "Gmail, iCloud und Yahoo benötigen ein App-Passwort statt Ihres Kontopassworts. Erstellen Sie eines in den Sicherheitseinstellungen Ihres Kontos und verwenden Sie es in Web Mails.", "Gmail, iCloud та Yahoo потребують пароль застосунку замість пароля акаунта. Створіть його в налаштуваннях безпеки акаунта й використайте у Web Mails.") },
		{ q: t3("Is my data safe?", "Sind meine Daten sicher?", "Чи безпечні мої дані?"), a: t3("Data is transferred over HTTPS, passwords are hashed, and access keys of connected services are stored encrypted.", "Daten werden über HTTPS übertragen, Passwörter gehasht, und Zugangsschlüssel verbundener Dienste verschlüsselt gespeichert.", "Дані передаються через HTTPS, паролі хешуються, а ключі доступу підключених сервісів зберігаються зашифрованими.") },
		{ q: t3("Can I use the CRM on my phone?", "Kann ich das CRM auf dem Smartphone nutzen?", "Чи можна користуватися CRM на телефоні?"), a: t3("Yes. The interface adapts to phones and tablets, and calls and chats work in the mobile browser.", "Ja. Die Oberfläche passt sich Smartphones und Tablets an, Anrufe und Chats funktionieren im mobilen Browser.", "Так. Інтерфейс адаптується до телефонів і планшетів, а дзвінки й чати працюють у мобільному браузері.") },
		{ q: t3("How do I export my data?", "Wie exportiere ich meine Daten?", "Як експортувати мої дані?"), a: t3("Contact support and we will send you an export of your contacts, companies and deals.", "Wenden Sie sich an den Support, und wir senden Ihnen einen Export Ihrer Kontakte, Firmen und Deals.", "Напишіть у підтримку — ми надішлемо експорт ваших контактів, компаній та угод.") },
	],
};

// ── Features ─────────────────────────────────────────────────────────────────
export const FEATURES = {
	title: t3("Features", "Funktionen", "Функції"),
	intro: t3("Everything a growing company needs to work with customers, in one place.", "Alles, was ein wachsendes Unternehmen für die Arbeit mit Kunden braucht, an einem Ort.", "Усе, що потрібно компанії, яка зростає, для роботи з клієнтами — в одному місці."),
	items: [
		{ key: "deals", title: t3("Deals pipeline", "Deal-Pipeline", "Воронка угод"), text: t3("Kanban board with custom stages, drag and drop, comments and activity history.", "Kanban-Board mit eigenen Phasen, Drag & Drop, Kommentaren und Aktivitätsverlauf.", "Kanban-дошка з власними етапами, перетягуванням, коментарями та історією активності.") },
		{ key: "contacts", title: t3("Contacts and companies", "Kontakte und Firmen", "Контакти та компанії"), text: t3("Complete cards with notes, links between people and companies, and search.", "Vollständige Karten mit Notizen, Verknüpfungen zwischen Personen und Firmen und Suche.", "Повні картки з нотатками, зв’язками між людьми й компаніями та пошуком.") },
		{ key: "tasks", title: t3("Tasks and calendar", "Aufgaben und Kalender", "Завдання та календар"), text: t3("Deadlines, reminders and a shared company calendar with week and month views.", "Fristen, Erinnerungen und ein gemeinsamer Firmenkalender mit Wochen- und Monatsansicht.", "Дедлайни, нагадування та спільний календар компанії з поданням за тиждень і місяць.") },
		{ key: "inbox", title: t3("Unified inbox", "Einheitlicher Posteingang", "Єдина скринька"), text: t3("Telegram, Viber, Messenger, SMS and website chat answered from one page.", "Telegram, Viber, Messenger, SMS und Website-Chat auf einer Seite beantwortet.", "Telegram, Viber, Messenger, SMS і чат сайту — відповіді з однієї сторінки.") },
		{ key: "calls", title: t3("Calls in the browser", "Anrufe im Browser", "Дзвінки в браузері"), text: t3("Call customers and receive calls through Twilio with a full call log.", "Rufen Sie Kunden an und empfangen Sie Anrufe über Twilio mit vollständigem Anrufprotokoll.", "Телефонуйте клієнтам і приймайте дзвінки через Twilio з повним журналом.") },
		{ key: "mail", title: t3("Web mail", "Web-Mail", "Веб-пошта"), text: t3("Gmail, Outlook, iCloud, Yahoo or any IMAP mailbox with drafts, stars and search.", "Gmail, Outlook, iCloud, Yahoo oder beliebiges IMAP-Postfach mit Entwürfen, Sternen und Suche.", "Gmail, Outlook, iCloud, Yahoo або будь-яка IMAP-скринька з чернетками, зірочками та пошуком.") },
		{ key: "auto", title: t3("Automation", "Automatisierung", "Автоматизація"), text: t3("Rules that react to stages, variables and constants — fewer manual steps.", "Regeln, die auf Phasen, Variablen und Konstanten reagieren – weniger manuelle Schritte.", "Правила, що реагують на етапи, змінні та константи, — менше ручних дій.") },
		{ key: "marketing", title: t3("Marketing tools", "Marketing-Werkzeuge", "Маркетингові інструменти"), text: t3("Campaigns, ads, segments and templates with results in one table.", "Kampagnen, Anzeigen, Segmente und Vorlagen mit Ergebnissen in einer Tabelle.", "Кампанії, реклама, сегменти й шаблони з результатами в одній таблиці.") },
		{ key: "inventory", title: t3("Inventory management", "Bestandsverwaltung", "Керування запасами"), text: t3("Stock, sales, transfers and write-offs, connected to your customers.", "Bestand, Verkäufe, Umlagerungen und Abschreibungen, verknüpft mit Ihren Kunden.", "Запаси, продажі, переміщення та списання, пов’язані з вашими клієнтами.") },
	],
};

// ── Documentation ────────────────────────────────────────────────────────────
export const DOCS = {
	title: t3("Documentation", "Dokumentation", "Документація"),
	intro: t3("Short guides for the most common tasks.", "Kurze Anleitungen für die häufigsten Aufgaben.", "Короткі інструкції для найпоширеніших завдань."),
	sections: [
		{ id: "start", title: t3("Getting started", "Erste Schritte", "Початок роботи"), steps: [
			t3("Sign up and choose Company or Personal.", "Registrieren Sie sich und wählen Sie Company oder Personal.", "Зареєструйтеся й оберіть Company або Personal."),
			t3("Open the Dashboard: it shows your tasks, deals and progress.", "Öffnen Sie das Dashboard: Es zeigt Ihre Aufgaben, Deals und Fortschritte.", "Відкрийте Dashboard: там ваші завдання, угоди та прогрес."),
			t3("Add your first company, contact and deal in the CRM section.", "Legen Sie im Bereich CRM Ihre erste Firma, Ihren ersten Kontakt und Deal an.", "Додайте першу компанію, контакт і угоду в розділі CRM."),
		] },
		{ id: "dashboard", title: t3("Dashboard", "Übersicht", "Інформаційна панель"), steps: [
			t3("At the top sit four cards: deals over the chosen period (month, week or year), tasks by status, the money summary (revenue paid, outstanding, overdue, profit) and ad spend.", "Oben stehen vier Karten: Deals im gewählten Zeitraum (Monat, Woche oder Jahr), Aufgaben nach Status, die Geldübersicht (bezahlter Umsatz, Offen, Überfällig, Gewinn) und Werbeausgaben.", "Угорі — чотири картки: угоди за обраний період (місяць, тиждень чи рік), завдання за станом, грошовий підсумок (оплачений дохід, до отримання, прострочене, прибуток) і витрати на рекламу."),
			t3("Below them is the day: pick a date in the week strip and see that day's tasks and calendar events.", "Darunter steht der Tag: Wählen Sie im Wochenstreifen ein Datum und sehen Sie dessen Aufgaben und Termine.", "Нижче — день: оберіть дату в смузі тижня й побачите завдання та події цього дня."),
			t3("Each card leads into its section: Details in the finance or ads card, Open calendar in the events, Open Tasks and Projects in the task list.", "Jede Karte führt in ihren Bereich: Details in der Finanz- oder Werbekarte, Open calendar bei den Terminen, Open Tasks and Projects in der Aufgabenliste.", "Кожна картка веде у свій розділ: Details у картці фінансів чи реклами, Open calendar — біля подій, Open Tasks and Projects — у списку завдань."),
		] },
		{ id: "crm", title: t3("Deals, contacts and companies", "Deals, Kontakte und Firmen", "Угоди, контакти та компанії"), steps: [
			t3("In CRM → Deals press Add in a column to create a deal card.", "Klicken Sie unter CRM → Deals in einer Spalte auf Add, um eine Deal-Karte anzulegen.", "У CRM → Deals натисніть Add у колонці, щоб створити картку угоди."),
			t3("Drag cards between stages, or open a card to edit fields and add comments.", "Ziehen Sie Karten zwischen Phasen oder öffnen Sie eine Karte, um Felder zu bearbeiten und Kommentare hinzuzufügen.", "Перетягуйте картки між етапами або відкрийте картку, щоб редагувати поля й додавати коментарі."),
			t3("Rename, recolor and reorder stages with the gear icon next to a stage.", "Benennen Sie Phasen mit dem Zahnrad neben der Phase um, färben Sie sie ein und ordnen Sie sie neu an.", "Перейменовуйте, перефарбовуйте й змінюйте порядок етапів через значок шестерні біля етапу."),
		] },
		{ id: "tasks", title: t3("Tasks and calendar", "Aufgaben und Kalender", "Завдання та календар"), steps: [
			t3("Create tasks in Tasks and Projects; set a deadline and a responsible person.", "Erstellen Sie Aufgaben unter Tasks and Projects; legen Sie Frist und Verantwortlichen fest.", "Створюйте завдання в Tasks and Projects; вкажіть дедлайн і відповідального."),
			t3("Tasks with deadlines appear in the Calendar and on the Dashboard.", "Aufgaben mit Frist erscheinen im Kalender und auf dem Dashboard.", "Завдання з дедлайнами з’являються в Calendar і на Dashboard."),
		] },
		{ id: "integrations", title: t3("Connecting channels", "Kanäle verbinden", "Підключення каналів"), steps: [
			t3("Telegram: create a bot with @BotFather and paste its token in Settings → Integration.", "Telegram: Erstellen Sie einen Bot mit @BotFather und fügen Sie dessen Token in Settings → Integration ein.", "Telegram: створіть бота через @BotFather і вставте його токен у Settings → Integration."),
			t3("Phone and SMS: enter your Twilio Account SID, Auth Token and phone number.", "Telefon und SMS: Geben Sie Ihre Twilio Account SID, den Auth Token und die Telefonnummer ein.", "Телефон і SMS: введіть Twilio Account SID, Auth Token та номер телефону."),
			t3("Website chat: copy the code from Online Chat and paste it before the closing body tag of your site.", "Website-Chat: Kopieren Sie den Code aus Online Chat und fügen Sie ihn vor dem schließenden Body-Tag Ihrer Website ein.", "Чат сайту: скопіюйте код з Online Chat і вставте його перед закриваючим тегом body вашого сайту."),
			t3("Mail: use an app password for Gmail, iCloud and Yahoo.", "E-Mail: Verwenden Sie für Gmail, iCloud und Yahoo ein App-Passwort.", "Пошта: для Gmail, iCloud та Yahoo використовуйте пароль застосунку."),
		] },
		{ id: "finance", title: t3("Finance: quotes, orders, invoices, contracts", "Finanzen: Angebote, Aufträge, Rechnungen, Verträge", "Фінанси: пропозиції, замовлення, рахунки, договори"), steps: [
			t3("Open Finance → Settings first and pick your country: it sets the default VAT rate on new invoices (you can still change it on any line) and, if you are a small business (§19 UStG or similar), turn on the small-business exemption.", "Öffnen Sie zuerst Finance → Settings und wählen Sie Ihr Land: Es setzt den Standard-Mehrwertsteuersatz für neue Rechnungen (auf jeder Zeile weiterhin änderbar). Sind Sie Kleinunternehmer (§19 UStG o. Ä.), aktivieren Sie die Kleinunternehmerregelung.", "Спочатку відкрийте Finance → Settings і оберіть країну: вона задає стандартну ставку ПДВ для нових рахунків (її завжди можна змінити в конкретному рядку). Якщо ви — мала фірма (§19 UStG чи аналог), увімкніть звільнення від податку."),
			t3("Add your products and services in Finance → Products. Goods track stock quantity; services don't.", "Legen Sie Ihre Produkte und Dienstleistungen unter Finance → Products an. Waren führen einen Lagerbestand, Dienstleistungen nicht.", "Додайте товари та послуги в Finance → Products. У товарів є облік залишку, у послуг — ні."),
			t3("The usual flow: send a Quote → the customer accepts it → one click turns it into an Order → confirm the order and mark it fulfilled (this deducts stock for goods) → create an Invoice from the order → send it → mark it paid once the money arrives. Skip the quote and order for a one-off invoice — create it directly in Invoices.", "Der übliche Ablauf: Angebot senden → Kunde nimmt an → mit einem Klick wird daraus ein Auftrag → Auftrag bestätigen und als erledigt markieren (zieht bei Waren den Bestand ab) → aus dem Auftrag eine Rechnung erstellen → senden → nach Zahlungseingang als bezahlt markieren. Für eine einmalige Rechnung Angebot und Auftrag überspringen und sie direkt unter Invoices anlegen.", "Типовий шлях: надіслати пропозицію (Quote) → клієнт приймає → одним кліком вона стає замовленням (Order) → підтвердіть замовлення й позначте виконаним (для товарів це спише залишок) → створіть рахунок (Invoice) із замовлення → надішліть → позначте оплаченим, коли гроші надійшли. Для разового рахунку пропозицію й замовлення можна пропустити — створіть його одразу в Invoices."),
			t3("A contract (Contracts tab) is separate from orders/invoices — it's for tracking the legal agreement itself. Create it, then Mark signed once the customer has signed; that fires the contract_signed automation event.", "Ein Vertrag (Tab Contracts) ist unabhängig von Aufträgen/Rechnungen — er dient der Nachverfolgung der eigentlichen Vereinbarung. Legen Sie ihn an und klicken Sie auf Mark signed, sobald der Kunde unterschrieben hat; das löst das Automatisierungsereignis contract_signed aus.", "Договір (вкладка Contracts) не пов’язаний напряму із замовленнями/рахунками — він для обліку самої юридичної угоди. Створіть його й натисніть Mark signed, коли клієнт підписав; це запускає подію автоматизації contract_signed."),
			t3("Overdue invoices are flagged automatically every day, and Finance → Overview shows revenue, outstanding and overdue amounts, expenses, profit and low-stock warnings — the same numbers as the Finance card on the main Dashboard.", "Überfällige Rechnungen werden täglich automatisch markiert, und Finance → Overview zeigt Umsatz, offene und überfällige Beträge, Ausgaben, Gewinn und Warnungen bei niedrigem Bestand — dieselben Zahlen wie die Finance-Karte auf dem Haupt-Dashboard.", "Прострочені рахунки автоматично позначаються щодня, а Finance → Overview показує виручку, суми до отримання й прострочені, витрати, прибуток та попередження про низький залишок — ті самі цифри, що й картка Finance на головному Dashboard."),
		] },
		{ id: "automation", title: t3("Automation rules", "Automatisierungsregeln", "Правила автоматизації"), steps: [
			t3("In Automation, create a rule: pick an event (a deal is created, an order changes status, an invoice is paid, a contract is signed, and more), an action (notify, create a task, add a note, move a stage, send an e-mail, call a webhook, or let the AI decide), and when it should run.", "Erstellen Sie unter Automation eine Regel: Wählen Sie ein Ereignis (ein Deal wird erstellt, ein Auftrag ändert den Status, eine Rechnung wird bezahlt, ein Vertrag wird unterschrieben u. v. m.), eine Aktion (benachrichtigen, Aufgabe erstellen, Notiz hinzufügen, Phase wechseln, E-Mail senden, Webhook aufrufen oder die KI entscheiden lassen) und den Zeitpunkt.", "В Automation створіть правило: оберіть подію (створено угоду, замовлення змінило статус, рахунок оплачено, договір підписано й інші), дію (сповістити, створити завдання, додати нотатку, перемістити етап, надіслати e-mail, викликати webhook або дати вирішити AI) і коли її виконувати."),
			t3("Use {{...}} placeholders in your message to pull in real data, for example {{order.number}}, {{order.customerName}}, {{invoice.number}}, {{contract.value}} — see the field list shown next to the message box.", "Verwenden Sie {{...}}-Platzhalter in Ihrer Nachricht, um echte Daten einzufügen, z. B. {{order.number}}, {{order.customerName}}, {{invoice.number}}, {{contract.value}} — die Feldliste finden Sie neben dem Nachrichtenfeld.", "Використовуйте плейсхолдери {{...}} у повідомленні, щоб підставити реальні дані, наприклад {{order.number}}, {{order.customerName}}, {{invoice.number}}, {{contract.value}} — список полів показано біля поля повідомлення."),
			t3("Example: an order that reaches 'invoiced' status can automatically create a task 'Prepare the proposal', so nothing slips through after a sale.", "Beispiel: Ein Auftrag, der den Status 'invoiced' erreicht, kann automatisch die Aufgabe 'Angebot vorbereiten' erstellen, damit nach einem Verkauf nichts vergessen wird.", "Приклад: замовлення зі статусом 'invoiced' може автоматично створити завдання 'Підготувати пропозицію', щоб нічого не загубилося після продажу."),
			t3("The number of active rules is limited by your plan; the Automation log shows exactly which rule fired, when, and why one might have failed (for example a channel that isn't connected).", "Die Anzahl aktiver Regeln ist durch Ihren Tarif begrenzt; das Automatisierungsprotokoll zeigt genau, welche Regel wann ausgelöst wurde und warum eine fehlgeschlagen sein könnte (z. B. ein nicht verbundener Kanal).", "Кількість активних правил обмежена вашим тарифом; журнал автоматизації показує, яке саме правило спрацювало, коли і чому воно могло не виконатися (наприклад, канал не підключено)."),
		] },
		{ id: "ai", title: t3("Firmspace AI assistant", "Firmspace-KI-Assistent", "AI-асистент Firmspace"), steps: [
			t3("Open the sparkle icon in the header to chat with Firmspace AI. It can look up contacts, deals, tasks and employees, read attached PDFs and summarize a deal, contact or company.", "Öffnen Sie das Sternchen-Symbol in der Kopfzeile, um mit Firmspace AI zu chatten. Sie kann Kontakte, Deals, Aufgaben und Mitarbeitende nachschlagen, angehängte PDFs lesen und einen Deal, Kontakt oder eine Firma zusammenfassen.", "Відкрийте іконку зірочки в шапці, щоб почати чат з Firmspace AI. Вона може шукати контакти, угоди, завдання й співробітників, читати прикріплені PDF і робити стислий опис угоди, контакту чи компанії."),
			t3("It never changes anything without asking first: when it proposes a write action (create a task, send an e-mail...) you get a confirmation card and nothing happens until you approve it.", "Ohne vorherige Nachfrage ändert sie nie etwas: Wenn sie eine schreibende Aktion vorschlägt (Aufgabe erstellen, E-Mail senden ...), erhalten Sie eine Bestätigungskarte, und nichts geschieht, bevor Sie zustimmen.", "Вона ніколи нічого не змінює без запитання: коли вона пропонує дію запису (створити завдання, надіслати e-mail...), ви бачите картку підтвердження, і нічого не станеться, доки ви не погодитесь."),
			t3("You also get one-click Analyze buttons on e-mails and documents, and can turn on an autonomous 'AI decides and acts' step inside an automation rule (Professional plan).", "Außerdem gibt es Analyze-Buttons mit einem Klick für E-Mails und Dokumente, und Sie können einen autonomen 'KI entscheidet und handelt'-Schritt innerhalb einer Automatisierungsregel aktivieren (Tarif Professional).", "Також доступні кнопки Analyze в один клік для листів і документів, а в правилі автоматизації можна увімкнути автономний крок 'AI вирішує та діє' (тариф Professional)."),
			t3("Daily requests are limited by your plan; remaining requests are shown at the top of the chat.", "Die täglichen Anfragen sind durch Ihren Tarif begrenzt; die verbleibende Anzahl wird oben im Chat angezeigt.", "Кількість запитів на день обмежена вашим тарифом; залишок показано вгорі чату."),
		] },
		{ id: "ads", title: t3("Ads performance", "Anzeigenleistung", "Ефективність реклами"), steps: [
			t3("In Marketing → Ads, connect Google Ads or Meta Ads (Standard plan or higher) to see spend, clicks and conversions next to your CRM data, without switching tabs.", "Verbinden Sie unter Marketing → Ads Google Ads oder Meta Ads (Tarif Standard oder höher), um Ausgaben, Klicks und Conversions direkt neben Ihren CRM-Daten zu sehen, ohne den Tab zu wechseln.", "У Marketing → Ads підключіть Google Ads або Meta Ads (тариф Standard і вище), щоб бачити витрати, кліки та конверсії поряд із даними CRM, не перемикаючи вкладки."),
			t3("The Ads card on the Dashboard summarizes performance across connected platforms.", "Die Ads-Karte auf dem Dashboard fasst die Leistung über alle verbundenen Plattformen zusammen.", "Картка Ads на Dashboard підсумовує ефективність за всіма підключеними платформами."),
		] },
		{ id: "account", title: t3("Account and team", "Konto und Team", "Акаунт і команда"), steps: [
			t3("Edit your profile, timezone and notifications in Settings.", "Bearbeiten Sie Profil, Zeitzone und Benachrichtigungen unter Settings.", "Редагуйте профіль, часовий пояс і сповіщення в Settings."),
			t3("Add colleagues in Settings → Colleagues, and choose their role (admin, manager, employee, viewer) and, if needed, exactly which sections they can access.", "Fügen Sie Kollegen unter Settings → Colleagues hinzu und wählen Sie ihre Rolle (Admin, Manager, Mitarbeiter, Betrachter) und bei Bedarf genau die Bereiche, auf die sie zugreifen dürfen.", "Додавайте колег у Settings → Colleagues і обирайте їхню роль (admin, manager, employee, viewer) та, за потреби, до яких саме розділів вони матимуть доступ."),
		] },
		{ id: "billing", title: t3("Plans and billing", "Tarife und Abrechnung", "Тарифи та оплата"), steps: [
			t3("Compare plans and see exactly what each includes in Upgrade Your Plan — the same three tiers shown on the public Pricing page, with your current plan highlighted.", "Vergleichen Sie die Tarife und sehen Sie genau, was jeder enthält, unter Upgrade Your Plan — dieselben drei Stufen wie auf der öffentlichen Preisseite, mit hervorgehobenem aktuellem Tarif.", "Порівняйте тарифи й подивіться, що саме входить у кожен, у розділі Upgrade Your Plan — ті самі три рівні, що й на публічній сторінці цін, із виділеним поточним тарифом."),
			t3("Paying by card, SEPA, Apple/Google Pay, PayPal or Klarna goes through Stripe Checkout; there is also a pay-by-invoice option for companies and, where enabled, payment in cryptocurrency.", "Die Zahlung per Karte, SEPA, Apple/Google Pay, PayPal oder Klarna erfolgt über Stripe Checkout; für Unternehmen gibt es außerdem eine Zahlung auf Rechnung und, sofern aktiviert, eine Zahlung in Kryptowährung.", "Оплата карткою, SEPA, Apple/Google Pay, PayPal чи Klarna проходить через Stripe Checkout; для компаній також є оплата за рахунком і, якщо ввімкнено, оплата криптовалютою."),
			t3("Manage your payment method, invoices and cancellation from Manage billing (opens Stripe's own billing portal).", "Verwalten Sie Zahlungsmethode, Rechnungen und Kündigung über Manage billing (öffnet das Kundenportal von Stripe).", "Керуйте способом оплати, рахунками й скасуванням через Manage billing (відкриває платіжний кабінет Stripe)."),
		] },
		{ id: "feed", title: t3("Feed", "Feed", "Стрічка"), steps: [
			t3("Write a post for the whole team or pick individual colleagues under To; an emoji button sits next to the text.", "Schreiben Sie einen Beitrag für das ganze Team oder wählen Sie unter To einzelne Kollegen; neben dem Text steht eine Emoji-Auswahl.", "Напишіть допис для всієї команди або оберіть окремих колег у To; поруч із текстом — вибір емодзі."),
			t3("Under a post you can comment, react with an emoji, turn it into a task or news, and follow the thread — new comments then come to you as notifications.", "Unter einem Beitrag können Sie kommentieren, mit einem Emoji reagieren, ihn in eine Aufgabe oder eine Neuigkeit umwandeln und dem Verlauf folgen — neue Kommentare kommen dann als Benachrichtigung.", "Під дописом можна коментувати, реагувати емодзі, перетворити його на завдання або новину та стежити за гілкою — нові коментарі тоді приходять сповіщенням."),
			t3("Pinned posts stay on top, and the chips All, News and Tasks plus the search over author, text and comments narrow the list. A post addressed to individual colleagues notifies only them.", "Angeheftete Beiträge bleiben oben; die Reiter All, News und Tasks sowie die Suche über Autor, Text und Kommentare grenzen die Liste ein. Ein Beitrag an einzelne Kollegen benachrichtigt nur diese.", "Закріплені дописи залишаються вгорі; вкладки All, News і Tasks та пошук за автором, текстом і коментарями звужують список. Допис, адресований окремим колегам, сповіщає лише їх."),
		] },
		{ id: "chat_and_calls", title: t3("Chat and calls", "Chat und Anrufe", "Чат і дзвінки"), steps: [
			t3("Connect channels in Settings → Integration: Telegram, Viber, WhatsApp, Messenger, SMS or the website chat. Conversations from all of them land in one inbox.", "Verbinden Sie Kanäle unter Settings → Integration: Telegram, Viber, WhatsApp, Messenger, SMS oder den Website-Chat. Die Gespräche aus allen landen in einem Posteingang.", "Підключіть канали в Settings → Integration: Telegram, Viber, WhatsApp, Messenger, SMS або чат сайту. Листування з усіх потрапляє в одну скриньку."),
			t3("Open a conversation to reply; the paperclip sends a file, photo or voice message through that channel.", "Öffnen Sie ein Gespräch zum Antworten; die Büroklammer sendet Datei, Foto oder Sprachnachricht über den jeweiligen Kanal.", "Відкрийте переписку, щоб відповісти; скріпка надсилає файл, фото чи голосове через відповідний канал."),
			t3("The handset opens the dialer: with a connected provider (Twilio or your own SIP) you call from the browser, and the call is recorded in the conversation.", "Der Hörer öffnet die Wählhilfe: Mit einem verbundenen Anbieter (Twilio oder eigenes SIP) telefonieren Sie aus dem Browser, und der Anruf wird im Gespräch festgehalten.", "Слухавка відкриває набір: із підключеним провайдером (Twilio або власний SIP) ви телефонуєте з браузера, а дзвінок залишається в переписці."),
		] },
		{ id: "calendar", title: t3("Calendar", "Kalender", "Календар"), steps: [
			t3("The calendar shows a month or a week; a click on a day opens a new event, a click on an event opens it for editing.", "Der Kalender zeigt Monat oder Woche; ein Klick auf einen Tag öffnet einen neuen Termin, ein Klick auf einen Termin die Bearbeitung.", "Календар показує місяць або тиждень; натиск на день відкриває нову подію, натиск на подію — редагування."),
			t3("My Calendar is visible only to you, Company Calendar to the whole team — the switch sits above the grid.", "Mein Kalender sehen nur Sie, den Firmenkalender das ganze Team — der Umschalter steht über dem Raster.", "Мій календар бачите лише ви, календар фірми — уся команда; перемикач над сіткою."),
			t3("Under Calendars you connect Google or iCloud: Google exchanges events in both directions, iCloud is read-only. Reminders arrive in the bell and, if enabled, by e-mail.", "Unter Kalender verbinden Sie Google oder iCloud: Google tauscht Termine in beide Richtungen aus, iCloud wird nur gelesen. Erinnerungen kommen in die Glocke und, wenn aktiviert, per E-Mail.", "У розділі «Календарі» підключаються Google або iCloud: із Google події ходять в обидва боки, iCloud лише читається. Нагадування приходять у дзвіночок і, якщо увімкнено, поштою."),
		] },
		{ id: "online_documents", title: t3("Documents", "Dokumente", "Документи"), steps: [
			t3("Files and folders of the company live here: upload a file, create a Google document, sheet or presentation, or move an item into a folder.", "Hier liegen Dateien und Ordner des Unternehmens: Datei hochladen, Google-Dokument, -Tabelle oder -Präsentation anlegen oder ein Element in einen Ordner verschieben.", "Тут зберігаються файли й папки фірми: завантажте файл, створіть документ, таблицю чи презентацію Google або перемістіть елемент у папку."),
			t3("Connect Google Drive to keep the files there as well — Move from Drive pulls in what you already have, without duplicates.", "Verbinden Sie Google Drive, um die Dateien auch dort zu halten — „Move from Drive“ holt Vorhandenes herein, ohne Duplikate.", "Підключіть Google Drive, щоб тримати файли й там — «Перенести з Диска» забирає наявне без дублів."),
		] },
		{ id: "web_mails", title: t3("Web mails", "Web-Mail", "Веб-пошта"), steps: [
			t3("Connect a mailbox: Gmail and Outlook sign in directly, other providers need an app password from the provider's settings.", "Verbinden Sie ein Postfach: Gmail und Outlook melden sich direkt an, andere Anbieter brauchen ein App-Passwort aus deren Einstellungen.", "Підключіть скриньку: Gmail і Outlook входять напряму, іншим потрібен пароль застосунку з їхніх налаштувань."),
			t3("Reading and answering happens inside the CRM; letters are matched to contacts and can be summarised by the AI assistant.", "Lesen und Antworten geschieht im CRM; Briefe werden Kontakten zugeordnet und können vom KI-Assistenten zusammengefasst werden.", "Читання й відповіді — усередині CRM; листи привʼязуються до контактів, і AI-асистент може зробити стислий опис."),
		] },
		{ id: "company", title: t3("Employees and knowledge", "Mitarbeiter und Wissen", "Співробітники та знання"), steps: [
			t3("The employee directory shows who does what: name, role, department, contacts.", "Das Mitarbeiterverzeichnis zeigt, wer was macht: Name, Rolle, Abteilung, Kontakte.", "Довідник співробітників показує, хто чим займається: імʼя, роль, відділ, контакти."),
			t3("The knowledge base keeps articles in categories — onboarding, processes, policies — so that answers stay in the company, not in private chats.", "Die Wissensbasis sammelt Artikel in Kategorien — Onboarding, Prozesse, Richtlinien — damit Antworten im Unternehmen bleiben und nicht in privaten Chats.", "База знань збирає статті за категоріями — онбординг, процеси, правила, — щоб відповіді залишалися у фірмі, а не в приватних чатах."),
		] },
		{ id: "marketing", title: t3("Marketing", "Marketing", "Маркетинг"), steps: [
			t3("Plan a campaign, choose its channel, and watch the results next to your CRM data — no separate tool needed.", "Planen Sie eine Kampagne, wählen Sie den Kanal und sehen Sie die Ergebnisse neben Ihren CRM-Daten — ohne separates Werkzeug.", "Плануйте кампанію, обирайте канал і дивіться результати поряд із даними CRM — без окремого інструмента."),
			t3("Ads performance shows spend, clicks and conversions from connected ad accounts; the Ads card on the Dashboard summarises them.", "Die Anzeigenleistung zeigt Ausgaben, Klicks und Conversions aus verbundenen Werbekonten; die Ads-Karte auf dem Dashboard fasst sie zusammen.", "Ефективність реклами показує витрати, кліки та конверсії з підключених кабінетів; картка Ads на Dashboard їх підсумовує."),
		] },
		{ id: "settings", title: t3("Settings", "Einstellungen", "Налаштування"), steps: [
			t3("Profile: name, timezone, interface language and notifications — in the browser, by e-mail, with quiet hours.", "Profil: Name, Zeitzone, Sprache der Oberfläche und Benachrichtigungen — im Browser, per E-Mail, mit Ruhezeiten.", "Профіль: імʼя, часовий пояс, мова інтерфейсу та сповіщення — у браузері, поштою, з тихими годинами."),
			t3("Integration gathers channels, mail, telephony and documents in one place; each card shows its status and what to do when it needs attention.", "Integration sammelt Kanäle, E-Mail, Telefonie und Dokumente an einem Ort; jede Karte zeigt ihren Status und was zu tun ist, wenn sie Aufmerksamkeit braucht.", "Integration збирає канали, пошту, телефонію й документи в одному місці; кожна картка показує стан і що робити, якщо потрібна увага."),
		] },
	],
	// Строка для разделов кабинета, текст по которым ещё пишется: список берётся из самой навигации,
	// поэтому новый раздел появляется в документации сразу, а не после правки этой страницы
	soon: t3("This section exists in the cabinet; a detailed description will appear here.", "Diesen Bereich gibt es im Kabinett; eine ausführliche Beschreibung folgt hier.", "Цей розділ є в кабінеті; докладний опис зʼявиться тут."),
};

// ── Privacy policy ───────────────────────────────────────────────────────────
export const PRIVACY = {
	title: t3("Privacy policy", "Datenschutzerklärung", "Політика конфіденційності"),
	updated: t3("Last updated: September 2026", "Zuletzt aktualisiert: September 2026", "Востаннє оновлено: вересень 2026"),
	sections: [
		{ title: t3("1. Who we are", "1. Wer wir sind", "1. Хто ми"), text: t3("Firmspace AI is a customer relationship management service. This policy explains what personal data we process and why.", "Firmspace AI ist ein Service für Kundenbeziehungsmanagement. Diese Erklärung beschreibt, welche personenbezogenen Daten wir verarbeiten und warum.", "Firmspace AI — сервіс керування взаєминами з клієнтами. Ця політика пояснює, які персональні дані ми обробляємо та навіщо.") },
		{ title: t3("2. Data we collect", "2. Welche Daten wir erheben", "2. Які дані ми збираємо"), text: t3("Account data (name, e-mail, company), the content you add to the CRM (contacts, deals, tasks, messages) and technical data such as browser type and language.", "Kontodaten (Name, E-Mail, Firma), Inhalte, die Sie im CRM anlegen (Kontakte, Deals, Aufgaben, Nachrichten) sowie technische Daten wie Browsertyp und Sprache.", "Дані акаунта (ім’я, e-mail, компанія), вміст, який ви додаєте в CRM (контакти, угоди, завдання, повідомлення), та технічні дані, як-от тип браузера й мова.") },
		{ title: t3("3. How we use it", "3. Wie wir Daten nutzen", "3. Як ми використовуємо дані"), text: t3("To provide and improve the service, to keep your account secure, to answer your requests and to send important service messages.", "Um den Service bereitzustellen und zu verbessern, Ihr Konto zu schützen, Ihre Anfragen zu beantworten und wichtige Servicenachrichten zu senden.", "Щоб надавати й покращувати сервіс, захищати ваш акаунт, відповідати на запити та надсилати важливі службові повідомлення.") },
		{ title: t3("4. Connected services", "4. Verbundene Dienste", "4. Підключені сервіси"), text: t3("When you connect Twilio, Telegram, Viber, Messenger or a mailbox, we store the access keys encrypted and use them only to send and receive messages on your behalf.", "Wenn Sie Twilio, Telegram, Viber, Messenger oder ein Postfach verbinden, speichern wir die Zugangsschlüssel verschlüsselt und nutzen sie nur, um in Ihrem Auftrag Nachrichten zu senden und zu empfangen.", "Коли ви підключаєте Twilio, Telegram, Viber, Messenger або поштову скриньку, ми зберігаємо ключі доступу в зашифрованому вигляді й використовуємо їх лише для надсилання та отримання повідомлень від вашого імені.") },
		{ title: t3("5. Sharing", "5. Weitergabe", "5. Передача даних"), text: t3("We do not sell your data. We share it only with infrastructure providers needed to run the service (hosting, database) and when the law requires it.", "Wir verkaufen Ihre Daten nicht. Wir geben sie nur an Infrastrukturanbieter weiter, die für den Betrieb nötig sind (Hosting, Datenbank), und wenn das Gesetz es verlangt.", "Ми не продаємо ваші дані. Ми передаємо їх лише інфраструктурним провайдерам, потрібним для роботи сервісу (хостинг, база даних), і коли цього вимагає закон.") },
		{ title: t3("6. Security", "6. Sicherheit", "6. Безпека"), text: t3("Data is transferred over HTTPS, passwords are stored as hashes and access to the database is restricted.", "Daten werden über HTTPS übertragen, Passwörter als Hashes gespeichert und der Datenbankzugriff ist eingeschränkt.", "Дані передаються через HTTPS, паролі зберігаються як хеші, а доступ до бази даних обмежено.") },
		{ title: t3("7. Your rights", "7. Ihre Rechte", "7. Ваші права"), text: t3("You can access, correct, export or delete your data. Write to hello@firmspace.example and we will respond within 30 days.", "Sie können Ihre Daten einsehen, berichtigen, exportieren oder löschen lassen. Schreiben Sie an hello@firmspace.example, wir antworten innerhalb von 30 Tagen.", "Ви можете переглянути, виправити, експортувати або видалити свої дані. Напишіть на hello@firmspace.example — ми відповімо протягом 30 днів.") },
		{ title: t3("8. Changes", "8. Änderungen", "8. Зміни"), text: t3("If we change this policy, we will publish the new version on this page.", "Wenn wir diese Erklärung ändern, veröffentlichen wir die neue Version auf dieser Seite.", "Якщо ми змінимо цю політику, нова версія з’явиться на цій сторінці.") },
	],
};

// ── Referral program ─────────────────────────────────────────────────────────
export const REFERRAL = {
	title: t3("Referral program", "Empfehlungsprogramm", "Реферальна програма"),
	intro: t3("Recommend Firmspace AI to other companies and get a free month for every company that subscribes.", "Empfehlen Sie Firmspace AI anderen Unternehmen und erhalten Sie für jedes Unternehmen, das abonniert, einen Gratismonat.", "Рекомендуйте Firmspace AI іншим компаніям і отримуйте безкоштовний місяць за кожну, що оформить підписку."),
	stepsTitle: t3("How it works", "So funktioniert es", "Як це працює"),
	steps: [
		{ title: t3("Share your link", "Teilen Sie Ihren Link", "Поділіться посиланням"), text: t3("Send your personal link to a colleague, partner or client.", "Senden Sie Ihren persönlichen Link an Kollegen, Partner oder Kunden.", "Надішліть особисте посилання колезі, партнеру чи клієнту.") },
		{ title: t3("They subscribe", "Sie abonnieren", "Вони оформлюють підписку"), text: t3("The company signs up and chooses the Standard or Professional plan.", "Das Unternehmen registriert sich und wählt den Tarif Standard oder Professional.", "Компанія реєструється й обирає тариф Standard або Professional.") },
		{ title: t3("You both win", "Sie gewinnen beide", "Виграють обоє"), text: t3("You get one free month, and the new company gets 10% off its first year.", "Sie erhalten einen Gratismonat, und das neue Unternehmen 10 % Rabatt auf das erste Jahr.", "Ви отримуєте безкоштовний місяць, а нова компанія — знижку 10% на перший рік.") },
	],
	linkLabel: t3("Your referral link", "Ihr Empfehlungslink", "Ваше реферальне посилання"),
	copy: t3("Copy link", "Link kopieren", "Копіювати посилання"),
	copied: t3("Copied!", "Kopiert!", "Скопійовано!"),
	note: t3("Sign in to get your personal link. Rewards are credited after the first payment of the invited company.", "Melden Sie sich an, um Ihren persönlichen Link zu erhalten. Prämien werden nach der ersten Zahlung des eingeladenen Unternehmens gutgeschrieben.", "Увійдіть, щоб отримати особисте посилання. Винагороду нараховують після першого платежу запрошеної компанії."),
};

// ── Impressum (legal notice, §5 TMG) ─────────────────────────────────────────
// ШАБЛОН: все значения в квадратных скобках — заглушки. Перед публикацией для немецкого рынка их нужно заменить на
// реальные данные компании (юридическое название, адрес, торговый реестр, USt-IdNr., ответственное лицо и т.п.).
// placeholderNote показывается баннером наверху страницы на всех трёх языках, пока плейсхолдеры не заменены.
export const IMPRESSUM = {
	title: t3("Legal notice (Impressum)", "Impressum", "Правова інформація (Impressum)"),
	placeholderNote: t3(
		"Template — every value in [brackets] is a placeholder. Replace them with your company's real registration details before publishing this page.",
		"Vorlage — jeder Wert in [eckigen Klammern] ist ein Platzhalter. Ersetzen Sie diese vor der Veröffentlichung durch die echten Angaben Ihres Unternehmens.",
		"Шаблон — кожне значення в [дужках] є заглушкою. Перед публікацією замініть їх на реальні реєстраційні дані вашої компанії."
	),
	sections: [
		{
			title: t3("Information pursuant to § 5 TMG", "Angaben gemäß § 5 TMG", "Інформація відповідно до § 5 TMG"),
			text: t3(
				"[Your Company Legal Name] GmbH\n[Street and house number]\n[Postal code] [City], [Country]",
				"[Ihr Firmenname] GmbH\n[Straße und Hausnummer]\n[PLZ] [Ort], [Land]",
				"[Юридична назва компанії] GmbH\n[Вулиця, номер будинку]\n[Поштовий індекс] [Місто], [Країна]"
			),
		},
		{
			title: t3("Represented by", "Vertreten durch", "Представник"),
			text: t3("Managing director: [Full name]", "Geschäftsführer/in: [Vor- und Nachname]", "Керівник: [Повне ім’я]"),
		},
		{
			title: t3("Contact", "Kontakt", "Контакти"),
			text: t3("Phone: [+49 XX XXXXXXXX]\nE-mail: [legal@yourcompany.example]", "Telefon: [+49 XX XXXXXXXX]\nE-Mail: [legal@yourcompany.example]", "Телефон: [+49 XX XXXXXXXX]\nE-mail: [legal@yourcompany.example]"),
		},
		{
			title: t3("Commercial register", "Registereintrag", "Реєстрація"),
			text: t3(
				"Registration court: [Amtsgericht ...]\nRegistration number: [HRB XXXXX]",
				"Registergericht: [Amtsgericht ...]\nRegisternummer: [HRB XXXXX]",
				"Суд реєстрації: [Amtsgericht ...]\nРеєстраційний номер: [HRB XXXXX]"
			),
		},
		{
			title: t3("VAT identification number", "Umsatzsteuer-ID", "Ідентифікаційний номер ПДВ"),
			text: t3(
				"VAT ID according to §27a of the German VAT act: [DE XXXXXXXXX]",
				"USt-IdNr. gemäß §27a Umsatzsteuergesetz: [DE XXXXXXXXX]",
				"Ідентифікаційний номер платника ПДВ згідно з §27a UStG: [DE XXXXXXXXX]"
			),
		},
		{
			title: t3("Responsible for content (§ 18 Abs. 2 MStV)", "Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV", "Відповідальний за зміст (§ 18 Abs. 2 MStV)"),
			text: t3("[Full name]\n[Same address as above]", "[Vor- und Nachname]\n[Anschrift wie oben]", "[Повне ім’я]\n[Адреса, як вище]"),
		},
		{
			title: t3("Dispute resolution", "Streitschlichtung", "Вирішення спорів"),
			text: t3(
				"The European Commission provides a platform for online dispute resolution (OS): https://ec.europa.eu/consumers/odr/. We are not willing or obliged to participate in dispute resolution proceedings before a consumer arbitration board.",
				"Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: https://ec.europa.eu/consumers/odr/. Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.",
				"Європейська комісія надає платформу для онлайн-вирішення спорів (OS): https://ec.europa.eu/consumers/odr/. Ми не зобов'язані та не бажаємо брати участь у процедурах вирішення спорів перед споживчим арбітражним органом."
			),
		},
		{
			title: t3("Liability for content and links", "Haftung für Inhalte und Links", "Відповідальність за зміст і посилання"),
			text: t3(
				"As a service provider, we are responsible for our own content on these pages under general law. We are not obliged to monitor transmitted or stored third-party information. Our site may contain links to external websites; we have no influence on their content and assume no liability for it.",
				"Als Diensteanbieter sind wir gemäß den allgemeinen Gesetzen für eigene Inhalte auf diesen Seiten verantwortlich. Wir sind nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen. Unsere Seite kann Links zu externen Websites enthalten; auf deren Inhalte haben wir keinen Einfluss und übernehmen dafür keine Haftung.",
				"Як постачальник послуг, ми відповідаємо за власний контент на цих сторінках згідно із загальним законодавством. Ми не зобов'язані відстежувати передану чи збережену інформацію третіх осіб. Наш сайт може містити посилання на зовнішні сайти; ми не маємо впливу на їхній вміст і не несемо за нього відповідальності."
			),
		},
	],
};

// ── Terms of service (AGB) ────────────────────────────────────────────────────
// ШАБЛОН — как и Impressum: значения в [скобках] нужно заменить реальными данными и, в идеале, юридически
// проверенным текстом (особенно разделы про оплату, отмену и ответственность) перед реальным запуском в Германии.
export const TERMS = {
	title: t3("Terms and conditions (AGB)", "Allgemeine Geschäftsbedingungen (AGB)", "Умови надання послуг"),
	placeholderNote: t3(
		"Template — replace [bracketed] placeholders with your real company details, and have the payment/cancellation/liability sections reviewed by a lawyer before publishing.",
		"Vorlage — ersetzen Sie die Platzhalter in [eckigen Klammern] durch die echten Angaben Ihres Unternehmens und lassen Sie die Abschnitte zu Zahlung, Kündigung und Haftung vor der Veröffentlichung juristisch prüfen.",
		"Шаблон — замініть значення в [дужках] на реальні дані вашої компанії, а розділи про оплату, скасування та відповідальність перевірте з юристом перед публікацією."
	),
	updated: t3("Last updated: September 2026", "Zuletzt aktualisiert: September 2026", "Востаннє оновлено: вересень 2026"),
	sections: [
		{
			title: t3("1. Scope", "1. Geltungsbereich", "1. Сфера дії"),
			text: t3(
				"These terms apply to all contracts between [Your Company Legal Name] GmbH (\"we\", \"us\") and its customers (\"you\") for the use of the Firmspace AI software as a service.",
				"Diese Bedingungen gelten für alle Verträge zwischen [Ihr Firmenname] GmbH („wir“) und ihren Kunden („Sie“) über die Nutzung der Software Firmspace AI als Dienstleistung.",
				"Ці умови застосовуються до всіх договорів між [Юридична назва компанії] GmbH («ми») та її клієнтами («ви») щодо використання програмного забезпечення Firmspace AI як послуги."
			),
		},
		{
			title: t3("2. Contract conclusion", "2. Vertragsschluss", "2. Укладення договору"),
			text: t3(
				"A contract is concluded when you complete registration and, for paid plans, when payment is confirmed by our payment provider.",
				"Ein Vertrag kommt mit Abschluss der Registrierung und, bei kostenpflichtigen Tarifen, mit Bestätigung der Zahlung durch unseren Zahlungsdienstleister zustande.",
				"Договір укладається після завершення реєстрації та, для платних тарифів, після підтвердження оплати нашим платіжним провайдером."
			),
		},
		{
			title: t3("3. Plans and pricing", "3. Tarife und Preise", "3. Тарифи та ціни"),
			text: t3(
				"Current plans and prices are shown on the Pricing page. Prices are in EUR [plus statutory VAT / already include VAT — confirm which applies in your country]. We may change prices for future billing periods with [30] days' notice.",
				"Aktuelle Tarife und Preise finden Sie auf der Preisseite. Preise verstehen sich in EUR [zzgl. gesetzlicher USt. / bereits inkl. USt. — bitte prüfen, was für Ihr Land zutrifft]. Preisänderungen für künftige Abrechnungszeiträume kündigen wir mit einer Frist von [30] Tagen an.",
				"Актуальні тарифи та ціни наведено на сторінці тарифів. Ціни вказано в EUR [плюс ПДВ згідно із законом / вже з ПДВ — уточніть, що застосовується у вашій країні]. Про зміну цін на майбутні періоди ми повідомляємо за [30] днів."
			),
		},
		{
			title: t3("4. Payment and billing", "4. Zahlung und Abrechnung", "4. Оплата та виставлення рахунків"),
			text: t3(
				"Paid plans are billed monthly or yearly in advance via our payment provider (card, SEPA and other methods it offers). Subscriptions renew automatically until cancelled.",
				"Kostenpflichtige Tarife werden monatlich oder jährlich im Voraus über unseren Zahlungsdienstleister abgerechnet (Karte, SEPA und weitere von ihm angebotene Methoden). Abonnements verlängern sich automatisch bis zur Kündigung.",
				"Платні тарифи оплачуються щомісяця або щорічно наперед через нашого платіжного провайдера (картка, SEPA та інші доступні способи). Підписка автоматично продовжується до скасування."
			),
		},
		{
			title: t3("5. Cancellation and right of withdrawal", "5. Kündigung und Widerrufsrecht", "5. Скасування та право на відмову"),
			text: t3(
				"You can cancel a paid plan at any time in Upgrade Your Plan; it stays active until the end of the paid period. Consumers in the EU have a 14-day right of withdrawal from the contract date, unless you have expressly requested immediate access and acknowledged the loss of that right. [Confirm exact wording with a lawyer for your country.]",
				"Sie können einen kostenpflichtigen Tarif jederzeit unter Upgrade Your Plan kündigen; er bleibt bis zum Ende des bezahlten Zeitraums aktiv. Verbraucher in der EU haben ein 14-tägiges Widerrufsrecht ab Vertragsschluss, sofern Sie nicht ausdrücklich den sofortigen Zugang verlangt und den Verlust dieses Rechts bestätigt haben. [Genauen Wortlaut mit einem Anwalt für Ihr Land abstimmen.]",
				"Ви можете скасувати платний тариф будь-коли в розділі Upgrade Your Plan; він залишається активним до кінця оплаченого періоду. Споживачі в ЄС мають право відмовитися від договору протягом 14 днів з дати укладення, якщо ви прямо не вимагали негайного доступу й не підтвердили втрату цього права. [Уточніть точне формулювання з юристом для вашої країни.]"
			),
		},
		{
			title: t3("6. Your data and content", "6. Ihre Daten und Inhalte", "6. Ваші дані та вміст"),
			text: t3(
				"You retain ownership of all data you enter into the CRM. We process it as described in our Privacy policy and only to provide the service to you.",
				"Sie behalten das Eigentum an allen Daten, die Sie in das CRM eingeben. Wir verarbeiten sie gemäß unserer Datenschutzerklärung und nur, um Ihnen den Dienst bereitzustellen.",
				"Ви зберігаєте право власності на всі дані, які вносите в CRM. Ми обробляємо їх згідно з нашою Політикою конфіденційності та лише для надання вам послуги."
			),
		},
		{
			title: t3("7. Availability and support", "7. Verfügbarkeit und Support", "7. Доступність і підтримка"),
			text: t3(
				"We aim for high availability but do not guarantee uninterrupted service. Planned maintenance is announced in advance where possible. Support is available as described on the Support page.",
				"Wir streben eine hohe Verfügbarkeit an, garantieren jedoch keinen unterbrechungsfreien Betrieb. Geplante Wartungsarbeiten kündigen wir nach Möglichkeit im Voraus an. Support erhalten Sie wie auf der Support-Seite beschrieben.",
				"Ми прагнемо до високої доступності, але не гарантуємо безперебійної роботи сервісу. Про заплановане технічне обслуговування ми повідомляємо заздалегідь, коли це можливо. Підтримка доступна, як описано на сторінці підтримки."
			),
		},
		{
			title: t3("8. Liability", "8. Haftung", "8. Відповідальність"),
			text: t3(
				"We are liable without limitation for intent and gross negligence, and for injury to life, body or health. For slight negligence, we are liable only for breach of a material contractual obligation, limited to foreseeable, typical damage. [Have this clause reviewed by a lawyer — liability limitations are strictly regulated under German law.]",
				"Wir haften unbeschränkt für Vorsatz und grobe Fahrlässigkeit sowie für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit. Bei leichter Fahrlässigkeit haften wir nur bei Verletzung einer wesentlichen Vertragspflicht, begrenzt auf den vorhersehbaren, vertragstypischen Schaden. [Diese Klausel unbedingt von einem Anwalt prüfen lassen — Haftungsbeschränkungen sind nach deutschem Recht streng geregelt.]",
				"Ми несемо необмежену відповідальність за умисел і грубу недбалість, а також за шкоду життю, тілу чи здоров'ю. За легку недбалість ми відповідаємо лише за порушення суттєвого договірного зобов'язання, обмежено передбачуваною типовою шкодою. [Обов'язково перевірте цей пункт з юристом — обмеження відповідальності суворо регулюються німецьким законодавством.]"
			),
		},
		{
			title: t3("9. Governing law and jurisdiction", "9. Anwendbares Recht und Gerichtsstand", "9. Застосовне право та юрисдикція"),
			text: t3(
				"These terms are governed by the law of [Germany / your country], excluding the UN Convention on Contracts for the International Sale of Goods. [Jurisdiction clauses against consumers are restricted by law — confirm with a lawyer.]",
				"Es gilt das Recht [Deutschlands / Ihres Landes] unter Ausschluss des UN-Kaufrechts. [Gerichtsstandsklauseln gegenüber Verbrauchern sind gesetzlich eingeschränkt — bitte anwaltlich prüfen.]",
				"Ці умови регулюються правом [Німеччини / вашої країни], за винятком Конвенції ООН про договори міжнародної купівлі-продажу товарів. [Положення про юрисдикцію щодо споживачів обмежені законом — уточніть з юристом.]"
			),
		},
		{
			title: t3("10. Changes to these terms", "10. Änderungen dieser Bedingungen", "10. Зміни до цих умов"),
			text: t3(
				"We may update these terms to reflect changes to the service or the law. We will notify active customers of material changes by e-mail at least [30] days before they take effect.",
				"Wir können diese Bedingungen anpassen, um Änderungen des Dienstes oder der Rechtslage abzubilden. Über wesentliche Änderungen informieren wir aktive Kunden mindestens [30] Tage vor Inkrafttreten per E-Mail.",
				"Ми можемо оновлювати ці умови, щоб відобразити зміни в сервісі чи законодавстві. Про суттєві зміни ми повідомимо активних клієнтів електронною поштою щонайменше за [30] днів до набрання чинності."
			),
		},
	],
};
