// app/[locale]/support.metadata.ts — SEO страницы «Поддержка / FAQ» (/support).
//
// Куда положить: /site/app/[locale]/support/metadata.ts (новый файл).
// Как подключить: в app/[locale]/support/page.tsx добавить
//
//   import { JsonLd } from "@/lib/seo";
//   export { generateMetadata, pageJsonLd } from "./metadata";
//   export default function Page({ params }: { params: { locale: string } }) { ... <JsonLd data={pageJsonLd(params.locale)} /> ... }
//
// FAQPage собирается из тех же вопросов, что видит пользователь: content/footerPages.ts (SUPPORT.faq).
// Тексты не переписаны — взяты дословно, включая цены тарифов из config/plans.ts (20 € / 53 €).

import type { Metadata } from "next";
import { asLocale, breadcrumbLd, faqPageLd, pageMetadata, siteUrl, type Locale } from "@/lib/seo";

export const PATH = "/support";

const SEO: Record<Locale, { title: string; description: string; keywords: string[] }> = {
	de: {
		title: "Support und FAQ – Firmspace AI",
		description:
			"Antworten auf häufige Fragen zu Konto, Tarifen, Integrationen, Datensicherheit und Export – und der direkte Weg zum Support von Firmspace AI.",
		keywords: [
			"Firmspace Support",
			"CRM FAQ",
			"Tarife FAQ",
			"Integration Hilfe",
			"Datenexport",
			"Konto erstellen CRM",
		],
	},
	en: {
		title: "Support and FAQ – Firmspace AI",
		description:
			"Answers to common questions about accounts, plans, integrations, data security and export — plus a direct way to reach Firmspace AI support.",
		keywords: ["Firmspace support", "CRM FAQ", "plans FAQ", "integration help", "data export", "create CRM account"],
	},
	ua: {
		title: "Підтримка та FAQ – Firmspace AI",
		description:
			"Відповіді на часті запитання про акаунт, тарифи, інтеграції, безпеку даних і експорт — і прямий шлях до підтримки Firmspace AI.",
		keywords: [
			"підтримка Firmspace",
			"FAQ CRM",
			"тарифи FAQ",
			"допомога з інтеграціями",
			"експорт даних",
			"створення акаунта CRM",
		],
	},
	uz: {
		title: "Qo'llab-quvvatlash va FAQ – Firmspace AI",
		description:
			"Hisob, tariflar, integratsiyalar, ma'lumotlar xavfsizligi va eksport haqidagi tez-tez so'raladigan savollarga javoblar — va Firmspace AI qo'llab-quvvatlashiga to'g'ridan-to'g'ri yo'l.",
		keywords: [
			"Firmspace qo'llab-quvvatlash",
			"CRM FAQ",
			"tariflar FAQ",
			"integratsiya yordami",
			"ma'lumotlar eksporti",
			"CRM hisob yaratish",
		],
	},
};

const CRUMB: Record<Locale, string> = { de: "Support / FAQ", en: "Support / FAQ", ua: "Підтримка / FAQ", uz: "Qo'llab-quvvatlash / FAQ" };

const FAQ: Record<Locale, { q: string; a: string }[]> = {
	de: [
		{
			q: "Wie erstelle ich ein Konto?",
			a: "Klicken Sie oben rechts auf Sign Up, wählen Sie Company oder Personal, füllen Sie das Formular aus und bestätigen Sie. Sie können das CRM sofort nutzen.",
		},
		{
			q: "Gibt es einen kostenlosen Tarif?",
			a: "Ja, aber eingeschränkt: Free deckt einen Benutzer mit Vertriebspipeline und Aufgaben ab. Der Team-Teil — Mitarbeiter und Wissensbasis, Feed und Kalender — beginnt mit Standard für 20 € im Monat (bis zu 50 Benutzer). Chat mit Kunden, Dokumente, Finanzen, Marketing, Werbung, Automatisierung und der KI-Assistent kommen mit Professional für 53 € im Monat, das auch die Benutzergrenze aufhebt.",
		},
		{
			q: "Kann ich meinen Tarif ändern oder kündigen?",
			a: "Ja, jederzeit unter Upgrade Your Plan. Die Änderung gilt ab der nächsten Abrechnungsperiode.",
		},
		{
			q: "Wie verbinde ich Telegram, Viber oder eine Telefonnummer?",
			a: "Öffnen Sie Settings → Integration, wählen Sie den Kanal, geben Sie den Schlüssel des Anbieters ein und klicken Sie auf Connect. Schritt-für-Schritt-Anleitungen finden Sie in der Dokumentation.",
		},
		{
			q: "Mein Postfach lässt sich nicht verbinden. Was tun?",
			a: "Gmail, iCloud und Yahoo benötigen ein App-Passwort statt Ihres Kontopassworts. Erstellen Sie eines in den Sicherheitseinstellungen Ihres Kontos und verwenden Sie es in Web Mails.",
		},
		{
			q: "Sind meine Daten sicher?",
			a: "Daten werden über HTTPS übertragen, Passwörter gehasht, und Zugangsschlüssel verbundener Dienste verschlüsselt gespeichert.",
		},
		{
			q: "Kann ich das CRM auf dem Smartphone nutzen?",
			a: "Ja. Die Oberfläche passt sich Smartphones und Tablets an, Anrufe und Chats funktionieren im mobilen Browser.",
		},
		{
			q: "Wie exportiere ich meine Daten?",
			a: "Wenden Sie sich an den Support, und wir senden Ihnen einen Export Ihrer Kontakte, Firmen und Deals.",
		},
	],
	en: [
		{
			q: "How do I create an account?",
			a: "Press Sign Up in the top right corner, choose Company or Personal, fill in the form and confirm. You can start using the CRM right away.",
		},
		{
			q: "Is there a free plan?",
			a: "Yes, but a limited one: Free covers one user with the sales pipeline and tasks. The team part — employees and knowledge base, the feed and the calendar — starts with Standard at €20 a month (up to 50 users). Chat with customers, documents, finance, marketing, ads, automation and the AI assistant come with Professional at €53 a month, which also removes the user limit.",
		},
		{
			q: "Can I change or cancel my plan?",
			a: "Yes, at any time in Upgrade Your Plan. The change applies from the next billing period.",
		},
		{
			q: "How do I connect Telegram, Viber or a phone number?",
			a: "Open Settings → Integration, choose the channel, enter the key from the provider and press Connect. Step-by-step guides are in the Documentation.",
		},
		{
			q: "My mailbox will not connect. What should I do?",
			a: "Gmail, iCloud and Yahoo need an app password instead of your account password. Create one in your account security settings and use it in Web Mails.",
		},
		{
			q: "Is my data safe?",
			a: "Data is transferred over HTTPS, passwords are hashed, and access keys of connected services are stored encrypted.",
		},
		{
			q: "Can I use the CRM on my phone?",
			a: "Yes. The interface adapts to phones and tablets, and calls and chats work in the mobile browser.",
		},
		{
			q: "How do I export my data?",
			a: "Contact support and we will send you an export of your contacts, companies and deals.",
		},
	],
	ua: [
		{
			q: "Як створити акаунт?",
			a: "Натисніть Sign Up у правому верхньому куті, оберіть Company або Personal, заповніть форму й підтвердіть. Користуватися CRM можна одразу.",
		},
		{
			q: "Чи є безкоштовний тариф?",
			a: "Так, але обмежений: Free покриває одного користувача з воронкою продажів і завданнями. Командна частина — співробітники та база знань, стрічка й календар — починається з тарифу Standard за 20 € на місяць (до 50 користувачів). Чат із клієнтами, документи, фінанси, маркетинг, реклама, автоматизація та AI-асистент доступні в Professional за 53 € на місяць, там же знімається обмеження на кількість користувачів.",
		},
		{
			q: "Чи можна змінити або скасувати тариф?",
			a: "Так, будь-коли в розділі Upgrade Your Plan. Зміна діє з наступного розрахункового періоду.",
		},
		{
			q: "Як підключити Telegram, Viber або номер телефону?",
			a: "Відкрийте Settings → Integration, оберіть канал, введіть ключ від провайдера й натисніть Connect. Покрокові інструкції — у Документації.",
		},
		{
			q: "Скринька не підключається. Що робити?",
			a: "Gmail, iCloud та Yahoo потребують пароль застосунку замість пароля акаунта. Створіть його в налаштуваннях безпеки акаунта й використайте у Web Mails.",
		},
		{
			q: "Чи безпечні мої дані?",
			a: "Дані передаються через HTTPS, паролі хешуються, а ключі доступу підключених сервісів зберігаються зашифрованими.",
		},
		{
			q: "Чи можна користуватися CRM на телефоні?",
			a: "Так. Інтерфейс адаптується до телефонів і планшетів, а дзвінки й чати працюють у мобільному браузері.",
		},
		{
			q: "Як експортувати мої дані?",
			a: "Напишіть у підтримку — ми надішлемо експорт ваших контактів, компаній та угод.",
		},
	],
	uz: [
		{
			q: "Hisobni qanday yarataman?",
			a: "Yuqori o'ng burchakdagi Sign Up tugmasini bosing, Company yoki Personal'ni tanlang, formani to'ldiring va tasdiqlang. CRM'dan darhol foydalanishni boshlashingiz mumkin.",
		},
		{
			q: "Bepul tarif bormi?",
			a: "Ha, lekin cheklangan: Free bitta foydalanuvchini savdo voronkasi va vazifalar bilan qamrab oladi. Jamoa qismi — xodimlar va bilimlar bazasi, lenta va kalendar — oyiga 20 € lik Standard tarifidan boshlanadi (50 tagacha foydalanuvchi). Mijozlar bilan chat, hujjatlar, moliya, marketing, reklama, avtomatlashtirish va AI-yordamchi oyiga 53 € lik Professional tarifida mavjud, u foydalanuvchilar chegarasini ham olib tashlaydi.",
		},
		{
			q: "Tarifimni o'zgartirish yoki bekor qilish mumkinmi?",
			a: "Ha, istalgan vaqtda Upgrade Your Plan bo'limida. O'zgarish keyingi hisob-kitob davridan kuchga kiradi.",
		},
		{
			q: "Telegram, Viber yoki telefon raqamini qanday ulayman?",
			a: "Settings → Integration bo'limini oching, kanalni tanlang, provayder kalitini kiriting va Connect tugmasini bosing. Bosqichma-bosqich ko'rsatmalar Hujjatlarda.",
		},
		{
			q: "Pochta qutim ulanmayapti. Nima qilishim kerak?",
			a: "Gmail, iCloud va Yahoo hisob paroli o'rniga ilova parolini talab qiladi. Uni hisob xavfsizlik sozlamalarida yarating va Web Mails'da foydalaning.",
		},
		{
			q: "Ma'lumotlarim xavfsizmi?",
			a: "Ma'lumotlar HTTPS orqali uzatiladi, parollar heshlanadi va ulangan xizmatlarning kalitlari shifrlangan holda saqlanadi.",
		},
		{
			q: "CRM'dan telefonda foydalanish mumkinmi?",
			a: "Ha. Interfeys telefon va planshetlarga moslashadi, qo'ng'iroqlar va chatlar mobil brauzerda ishlaydi.",
		},
		{
			q: "Ma'lumotlarimni qanday eksport qilaman?",
			a: "Qo'llab-quvvatlashga yozing — biz kontaktlar, kompaniyalar va bitimlaringiz eksportini yuboramiz.",
		},
	],
};

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
	const locale = asLocale(params.locale);
	return pageMetadata({ path: PATH, locale, ...SEO[locale] });
}

export function pageJsonLd(localeCode: string) {
	const locale = asLocale(localeCode);
	return [
		breadcrumbLd(locale, [
			{ name: "Firmspace AI", path: "/" },
			{ name: CRUMB[locale], path: PATH },
		]),
		{
			"@context": "https://schema.org",
			"@type": "WebPage",
			name: SEO[locale].title,
			description: SEO[locale].description,
			url: siteUrl(locale, PATH),
			inLanguage: locale === "ua" ? "uk" : locale,
		},
		faqPageLd(FAQ[locale]),
	];
}
