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
// Сами статьи теперь не здесь, а в БД (models/BlogPost.ts) — владелец платформы управляет ими из /crm/admin,
// не через правку кода. Ниже остаются только надписи интерфейса страницы блога.
export const BLOG = {
	title: t3("Blog", "Blog", "Блог"),
	readMore: t3("Read More", "Weiterlesen", "Читати далі"),
	back: t3("Back to blog", "Zurück zum Blog", "Назад до блогу"),
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
