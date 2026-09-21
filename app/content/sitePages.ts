import { t3 } from "./i18n";

// ── Our Services ─────────────────────────────────────────────────────────────
export const SERVICES = {
	title: t3("Our Services", "Unsere Leistungen", "Наші послуги"),
	items: [
		{ key: "data", title: t3("Customer Data Management", "Kundendatenverwaltung", "Управління даними клієнтів"), text: t3("One card for every contact and company: history, notes, deals and files in one place.", "Eine Karte für jeden Kontakt und jede Firma: Verlauf, Notizen, Deals und Dateien an einem Ort.", "Одна картка для кожного контакту й компанії: історія, нотатки, угоди та файли в одному місці.") },
		{ key: "sales", title: t3("Sales Automation", "Vertriebsautomatisierung", "Автоматизація продажів"), text: t3("A visual deals pipeline with stages, reminders and rules that move deals forward for you.", "Eine visuelle Deal-Pipeline mit Phasen, Erinnerungen und Regeln, die Deals für Sie voranbringen.", "Візуальна воронка угод з етапами, нагадуваннями та правилами, які просувають угоди за вас.") },
		{ key: "support", title: t3("Customer Support and Service", "Kundensupport und Service", "Підтримка та обслуговування клієнтів"), text: t3("Answer customers from one inbox: chat, SMS, calls, Telegram, Viber, Messenger and e-mail.", "Beantworten Sie Kunden aus einem Posteingang: Chat, SMS, Anrufe, Telegram, Viber, Messenger und E-Mail.", "Відповідайте клієнтам з однієї скриньки: чат, SMS, дзвінки, Telegram, Viber, Messenger та e-mail.") },
		{ key: "marketing", title: t3("Marketing Campaign Management", "Marketing-Kampagnenmanagement", "Керування маркетинговими кампаніями"), text: t3("Plan campaigns, ads and segments, and see which channels bring the customers.", "Planen Sie Kampagnen, Anzeigen und Segmente und sehen Sie, welche Kanäle Kunden bringen.", "Плануйте кампанії, рекламу та сегменти й бачте, які канали приводять клієнтів.") },
		{ key: "analytics", title: t3("Analytics and Reporting", "Analysen und Berichte", "Аналітика та звіти"), text: t3("Dashboards for deals, tasks and team activity — clear numbers instead of guesses.", "Dashboards für Deals, Aufgaben und Teamaktivität – klare Zahlen statt Vermutungen.", "Дашборди для угод, завдань та активності команди — чіткі цифри замість здогадок.") },
		{ key: "integration", title: t3("Integration and Mobility", "Integration und Mobilität", "Інтеграція та мобільність"), text: t3("Connect telephony, mail and messengers, and work from any device with a responsive interface.", "Verbinden Sie Telefonie, E-Mail und Messenger und arbeiten Sie mit einer responsiven Oberfläche auf jedem Gerät.", "Підключайте телефонію, пошту й месенджери та працюйте з будь-якого пристрою завдяки адаптивному інтерфейсу.") },
	],
};

// ── Blog ─────────────────────────────────────────────────────────────────────
export const BLOG = {
	title: t3("Blog", "Blog", "Блог"),
	readMore: t3("Read More", "Weiterlesen", "Читати далі"),
	back: t3("Back to blog", "Zurück zum Blog", "Назад до блогу"),
	posts: [
		{
			slug: "new-dashboard-look", image: "code", date: "2026-09-12",
			title: t3("New Dashboard look!", "Neues Dashboard-Design!", "Новий вигляд дашборду!"),
			excerpt: t3("The dashboard now shows your day at a glance: tasks, deals and team activity on one screen.", "Das Dashboard zeigt jetzt Ihren Tag auf einen Blick: Aufgaben, Deals und Teamaktivität auf einem Bildschirm.", "Дашборд тепер показує ваш день як на долоні: завдання, угоди та активність команди на одному екрані."),
			body: [
				t3("We redesigned the dashboard around one question: what should I do today? The calendar strip at the top lets you jump between days, and the task list below shows only what is due.", "Wir haben das Dashboard um eine Frage herum neu gestaltet: Was soll ich heute tun? Mit dem Kalenderstreifen oben springen Sie zwischen Tagen, die Aufgabenliste darunter zeigt nur, was fällig ist.", "Ми перепроєктували дашборд навколо одного питання: що мені робити сьогодні? Стрічка календаря вгорі дозволяє перемикати дні, а список завдань нижче показує лише те, що потрібно зробити."),
				t3("The deals chart and the progress ring give you the state of the pipeline in seconds. Switch between month and week to compare periods.", "Das Deal-Diagramm und der Fortschrittsring zeigen den Stand der Pipeline in Sekunden. Wechseln Sie zwischen Monat und Woche, um Zeiträume zu vergleichen.", "Діаграма угод і кільце прогресу за секунди показують стан воронки. Перемикайтеся між місяцем і тижнем, щоб порівнювати періоди."),
				t3("Everything is responsive: the same dashboard works on a desktop, a tablet and a phone.", "Alles ist responsiv: dasselbe Dashboard funktioniert auf Desktop, Tablet und Smartphone.", "Усе адаптивне: той самий дашборд працює на комп’ютері, планшеті й телефоні."),
			],
		},
		{
			slug: "unified-inbox", image: "sofa", date: "2026-09-05",
			title: t3("One inbox for every channel", "Ein Posteingang für jeden Kanal", "Одна скринька для кожного каналу"),
			excerpt: t3("Telegram, Viber, Messenger, SMS, calls and website chat now land in a single Chat and Calls page.", "Telegram, Viber, Messenger, SMS, Anrufe und Website-Chat landen jetzt auf einer Seite: Chat and Calls.", "Telegram, Viber, Messenger, SMS, дзвінки та чат сайту тепер потрапляють на одну сторінку — Chat and Calls."),
			body: [
				t3("Customers write where it is convenient for them. Instead of switching between apps, your team answers everything from Chat and Calls, and the reply goes back through the same channel.", "Kunden schreiben dort, wo es für sie bequem ist. Statt zwischen Apps zu wechseln, beantwortet Ihr Team alles in Chat and Calls, die Antwort geht über denselben Kanal zurück.", "Клієнти пишуть там, де їм зручно. Замість перемикання між застосунками ваша команда відповідає з Chat and Calls, а відповідь іде тим самим каналом."),
				t3("Connecting a channel takes a minute: open Settings → Integration, paste the key and press Connect. The CRM registers the webhooks for you.", "Einen Kanal zu verbinden dauert eine Minute: Settings → Integration öffnen, Schlüssel einfügen und auf Connect klicken. Das CRM registriert die Webhooks für Sie.", "Підключення каналу займає хвилину: відкрийте Settings → Integration, вставте ключ і натисніть Connect. CRM сама зареєструє вебхуки."),
				t3("Phone numbers found in your contacts are matched automatically, so you always see who is writing.", "Telefonnummern aus Ihren Kontakten werden automatisch zugeordnet, sodass Sie immer sehen, wer schreibt.", "Номери телефонів з ваших контактів зіставляються автоматично, тож ви завжди бачите, хто пише."),
			],
		},
		{
			slug: "call-from-browser", image: "laptop", date: "2026-08-28",
			title: t3("Calls straight from the browser", "Anrufe direkt aus dem Browser", "Дзвінки прямо з браузера"),
			excerpt: t3("Connect Twilio and call customers or pick up incoming calls without leaving the CRM.", "Verbinden Sie Twilio und rufen Sie Kunden an oder nehmen Sie Anrufe entgegen – ohne das CRM zu verlassen.", "Підключіть Twilio, телефонуйте клієнтам і приймайте вхідні дзвінки, не виходячи з CRM."),
			body: [
				t3("With Twilio connected, a call button appears in every phone conversation. Press it, allow the microphone once, and you are talking — the call is written to the conversation history.", "Ist Twilio verbunden, erscheint in jedem Telefongespräch ein Anrufknopf. Drücken, Mikrofon einmal erlauben, und Sie sprechen – der Anruf wird im Gesprächsverlauf festgehalten.", "Коли Twilio підключено, у кожній телефонній розмові з’являється кнопка дзвінка. Натисніть її, один раз дозвольте мікрофон — і ви розмовляєте; дзвінок записується в історію."),
				t3("Incoming calls ring in the browser with Answer and Decline buttons. Missed calls stay in the conversation, marked as unread.", "Eingehende Anrufe klingeln im Browser mit den Schaltflächen Annehmen und Ablehnen. Verpasste Anrufe bleiben im Gespräch, als ungelesen markiert.", "Вхідні дзвінки дзвонять у браузері з кнопками «Відповісти» та «Відхилити». Пропущені лишаються в розмові як непрочитані."),
			],
		},
		{
			slug: "mail-in-crm", image: "code", date: "2026-08-20",
			title: t3("Your mailbox inside the CRM", "Ihr Postfach im CRM", "Ваша пошта всередині CRM"),
			excerpt: t3("Add Gmail, Outlook, iCloud, Yahoo or any IMAP mailbox and write to customers without changing tabs.", "Fügen Sie Gmail, Outlook, iCloud, Yahoo oder ein beliebiges IMAP-Postfach hinzu und schreiben Sie Kunden ohne Tabwechsel.", "Додайте Gmail, Outlook, iCloud, Yahoo або будь-яку IMAP-скриньку й пишіть клієнтам, не змінюючи вкладку."),
			body: [
				t3("Web Mails syncs the latest letters from your mailbox and lets you reply, star, snooze and keep drafts. Your passwords are stored encrypted and are never shown in the browser.", "Web Mails synchronisiert die neuesten E-Mails Ihres Postfachs und lässt Sie antworten, markieren, zurückstellen und Entwürfe speichern. Ihre Passwörter werden verschlüsselt gespeichert und nie im Browser angezeigt.", "Web Mails синхронізує свіжі листи з вашої скриньки й дозволяє відповідати, позначати зірочкою, відкладати та зберігати чернетки. Паролі зберігаються в зашифрованому вигляді й ніколи не показуються в браузері."),
				t3("For Gmail and iCloud use an app password — it is safer than your main password and takes a minute to create.", "Verwenden Sie für Gmail und iCloud ein App-Passwort – es ist sicherer als Ihr Hauptpasswort und in einer Minute erstellt.", "Для Gmail та iCloud використовуйте пароль застосунку — він безпечніший за основний пароль і створюється за хвилину."),
			],
		},
		{
			slug: "website-chat", image: "sofa", date: "2026-08-11",
			title: t3("A chat bubble for your website", "Eine Chat-Blase für Ihre Website", "Віджет чату для вашого сайту"),
			excerpt: t3("Paste one line of code and visitors can write to you from any page of your site.", "Fügen Sie eine Codezeile ein, und Besucher können Ihnen von jeder Seite Ihrer Website schreiben.", "Вставте один рядок коду — і відвідувачі зможуть писати вам з будь-якої сторінки сайту."),
			body: [
				t3("Open Settings → Integration → Online Chat, choose the title and color, and copy the code. Messages from your visitors appear in Chat and Calls in real time.", "Öffnen Sie Settings → Integration → Online Chat, wählen Sie Titel und Farbe und kopieren Sie den Code. Nachrichten Ihrer Besucher erscheinen in Echtzeit in Chat and Calls.", "Відкрийте Settings → Integration → Online Chat, оберіть заголовок і колір та скопіюйте код. Повідомлення відвідувачів з’являються в Chat and Calls у реальному часі."),
				t3("The widget is tiny, does not slow the page down and speaks English, German and Ukrainian.", "Das Widget ist winzig, bremst die Seite nicht aus und spricht Englisch, Deutsch und Ukrainisch.", "Віджет крихітний, не гальмує сторінку й розмовляє англійською, німецькою та українською."),
			],
		},
		{
			slug: "three-plans", image: "laptop", date: "2026-08-01",
			title: t3("Three simple plans", "Drei einfache Tarife", "Три прості тарифи"),
			excerpt: t3("Start free, grow with Standard for €20 a month, or unlock everything with Professional for €35.", "Starten Sie kostenlos, wachsen Sie mit Standard für 20 € im Monat oder schalten Sie mit Professional für 35 € alles frei.", "Почніть безкоштовно, зростайте зі Standard за 20 € на місяць або відкрийте все з Professional за 35 €."),
			body: [
				t3("Free covers the basics: chat, calendar and feed for a small team. Standard adds HD video calls and the company workspace for €20 a month. Professional gives full access, including the knowledge base, for €35 a month.", "Free deckt die Grundlagen ab: Chat, Kalender und Feed für ein kleines Team. Standard ergänzt HD-Videoanrufe und den Firmenarbeitsbereich für 20 € im Monat. Professional bietet vollen Zugriff inklusive Wissensdatenbank für 35 € im Monat.", "Free покриває основне: чат, календар і стрічку для невеликої команди. Standard додає HD-відеодзвінки та робочу область компанії за 20 € на місяць. Professional дає повний доступ, включно з базою знань, за 35 € на місяць."),
				t3("Pay yearly and get two months for free. You can change the plan at any time.", "Zahlen Sie jährlich und erhalten Sie zwei Monate gratis. Sie können den Tarif jederzeit wechseln.", "Платіть за рік і отримайте два місяці безкоштовно. Тариф можна змінити будь-коли."),
			],
		},
	],
};

// ── Contact ──────────────────────────────────────────────────────────────────
export const CONTACT = {
	title: t3("Contact", "Kontakt", "Контакти"),
	subtitle: t3("Feel Free To Ask Us Any Question !", "Stellen Sie uns gerne jede Frage!", "Сміливо ставте нам будь-які запитання!"),
	name: t3("Name", "Name", "Ім’я"),
	email: t3("E-Mail", "E-Mail", "E-mail"),
	phone: t3("Phone", "Telefon", "Телефон"),
	message: t3("Message", "Nachricht", "Повідомлення"),
	namePh: t3("Type Your Name Here...", "Geben Sie Ihren Namen ein...", "Введіть ваше ім’я..."),
	emailPh: t3("Type Your Mail Here...", "Geben Sie Ihre E-Mail ein...", "Введіть вашу пошту..."),
	phonePh: t3("Type Your Phone Here...", "Geben Sie Ihre Telefonnummer ein...", "Введіть ваш телефон..."),
	messagePh: t3("Type Your Message Here...", "Geben Sie Ihre Nachricht ein...", "Введіть ваше повідомлення..."),
	send: t3("Send Message", "Nachricht senden", "Надіслати повідомлення"),
	sending: t3("Sending...", "Wird gesendet...", "Надсилання..."),
	sent: t3("Thank you! We received your message and will answer soon.", "Danke! Wir haben Ihre Nachricht erhalten und melden uns bald.", "Дякуємо! Ми отримали ваше повідомлення й скоро відповімо."),
	failed: t3("The message was not sent. Please check the fields and try again.", "Die Nachricht wurde nicht gesendet. Bitte prüfen Sie die Felder und versuchen Sie es erneut.", "Повідомлення не надіслано. Перевірте поля й спробуйте ще раз."),
	details: [
		{ label: t3("E-mail", "E-Mail", "E-mail"), value: "hello@firmspace.example" },
		{ label: t3("Phone", "Telefon", "Телефон"), value: "+49 30 1234 5678" },
		{ label: t3("Address", "Adresse", "Адреса"), value: "Friedrichstraße 100, 10117 Berlin" },
	],
};
