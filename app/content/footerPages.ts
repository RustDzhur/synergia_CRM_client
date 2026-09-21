import { t3 } from "./i18n";

// ── Team ─────────────────────────────────────────────────────────────────────
export const TEAM = {
	title: t3("Our Team", "Unser Team", "Наша команда"),
	intro: t3("A small team of engineers, designers and support specialists who build Firmspace CRM and answer your questions every day.", "Ein kleines Team aus Entwicklern, Designern und Support-Spezialisten, das Firmspace CRM baut und täglich Ihre Fragen beantwortet.", "Невелика команда інженерів, дизайнерів і спеціалістів підтримки, які створюють Firmspace CRM і щодня відповідають на ваші запитання."),
	members: [
		{ name: "Anna Keller", role: t3("CEO & Co-founder", "CEO & Mitgründerin", "CEO та співзасновниця"), bio: t3("Builds the vision and makes sure we solve real problems of small companies.", "Entwickelt die Vision und sorgt dafür, dass wir echte Probleme kleiner Unternehmen lösen.", "Формує бачення й стежить, щоб ми розв’язували реальні проблеми малого бізнесу.") },
		{ name: "Oleksandr Shevchenko", role: t3("CTO", "CTO", "Технічний директор"), bio: t3("Leads the platform architecture: performance, security and integrations.", "Verantwortet die Plattformarchitektur: Leistung, Sicherheit und Integrationen.", "Керує архітектурою платформи: продуктивність, безпека та інтеграції.") },
		{ name: "Lena Fischer", role: t3("Head of Design", "Leiterin Design", "Керівниця дизайну"), bio: t3("Makes complex workflows feel simple on every screen size.", "Macht komplexe Abläufe auf jeder Bildschirmgröße einfach.", "Робить складні процеси простими на екрані будь-якого розміру.") },
		{ name: "Maksym Bondar", role: t3("Senior Engineer", "Senior Engineer", "Провідний інженер"), bio: t3("Works on real-time messaging, telephony and mail synchronization.", "Arbeitet an Echtzeit-Messaging, Telefonie und E-Mail-Synchronisation.", "Працює над обміном повідомленнями, телефонією та синхронізацією пошти.") },
		{ name: "Sophie Wagner", role: t3("Customer Success", "Customer Success", "Успіх клієнтів"), bio: t3("Helps teams get started and get the most out of the CRM.", "Hilft Teams beim Einstieg und dabei, das Beste aus dem CRM herauszuholen.", "Допомагає командам почати роботу й отримати максимум від CRM.") },
		{ name: "Iryna Melnyk", role: t3("Marketing Lead", "Marketing-Leiterin", "Керівниця маркетингу"), bio: t3("Tells the story of Firmspace CRM and listens to what customers need.", "Erzählt die Geschichte von Firmspace CRM und hört zu, was Kunden brauchen.", "Розповідає історію Firmspace CRM і слухає, що потрібно клієнтам.") },
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
		{ q: t3("Is there a free plan?", "Gibt es einen kostenlosen Tarif?", "Чи є безкоштовний тариф?"), a: t3("Yes. Free includes chat, calendar and feed for up to 5 users. Standard costs €20 a month and Professional €35 a month.", "Ja. Free umfasst Chat, Kalender und Feed für bis zu 5 Benutzer. Standard kostet 20 € im Monat, Professional 35 € im Monat.", "Так. Free містить чат, календар і стрічку до 5 користувачів. Standard коштує 20 € на місяць, Professional — 35 € на місяць.") },
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
		{ id: "account", title: t3("Account and team", "Konto und Team", "Акаунт і команда"), steps: [
			t3("Edit your profile, timezone and notifications in Settings.", "Bearbeiten Sie Profil, Zeitzone und Benachrichtigungen unter Settings.", "Редагуйте профіль, часовий пояс і сповіщення в Settings."),
			t3("Add colleagues in Settings → Colleagues.", "Fügen Sie Kollegen unter Settings → Colleagues hinzu.", "Додавайте колег у Settings → Colleagues."),
		] },
	],
};

// ── Privacy policy ───────────────────────────────────────────────────────────
export const PRIVACY = {
	title: t3("Privacy policy", "Datenschutzerklärung", "Політика конфіденційності"),
	updated: t3("Last updated: September 2026", "Zuletzt aktualisiert: September 2026", "Востаннє оновлено: вересень 2026"),
	sections: [
		{ title: t3("1. Who we are", "1. Wer wir sind", "1. Хто ми"), text: t3("Firmspace CRM is a customer relationship management service. This policy explains what personal data we process and why.", "Firmspace CRM ist ein Service für Kundenbeziehungsmanagement. Diese Erklärung beschreibt, welche personenbezogenen Daten wir verarbeiten und warum.", "Firmspace CRM — сервіс керування взаєминами з клієнтами. Ця політика пояснює, які персональні дані ми обробляємо та навіщо.") },
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
	intro: t3("Recommend Firmspace CRM to other companies and get a free month for every company that subscribes.", "Empfehlen Sie Firmspace CRM anderen Unternehmen und erhalten Sie für jedes Unternehmen, das abonniert, einen Gratismonat.", "Рекомендуйте Firmspace CRM іншим компаніям і отримуйте безкоштовний місяць за кожну, що оформить підписку."),
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
