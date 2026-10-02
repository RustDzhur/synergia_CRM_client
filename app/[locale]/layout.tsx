import "./styles/globals.css";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import ErrorReporter from "@/components/crm/shared/ErrorReporter";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
	title: "Firmspace AI",
	description: "CRM, Team-Kommunikation, Projekte und Buchhaltung in einer Plattform — für kleine und mittlere Unternehmen.",
};

export default async function RootLayout({
	children,
	params: { locale } = { locale: "defaultLocale" },
}: {
	children: React.ReactNode;
	params?: { locale: string };
}) {
	let messages;
	try {		
		messages = (await import(`../../messages/${locale}.json`)).default;
	} catch (error) {
		notFound();
	}

	return (
		<html lang={locale === "ua" ? "uk" : locale}>
			<head>
				{locale === "ua" && <link rel="alternate" hrefLang="uk" href={`https://firmspace.de/ua${params?.page ?? ""}`} />}
				{locale === "en" && <link rel="alternate" hrefLang="en" href={`https://firmspace.de/en${params?.page ?? ""}`} />}
				{locale === "de" && <link rel="alternate" hrefLang="de" href={`https://firmspace.de/de${params?.page ?? ""}`} />}
				<link rel="canonical" href={`https://firmspace.de/${locale}${params?.page ?? ""}`} />
			</head>
			<body className={inter.className}>
				<NextIntlClientProvider locale={locale} messages={messages}>
					{children}
				</NextIntlClientProvider>
				{/* Vercel Web Analytics и Speed Insights: собирают данные только на развёрнутом сайте, после включения в панели Vercel */}
				<Analytics />
				<SpeedInsights />
				{/* Исключения в браузере с любой страницы — и публичной, и кабинета — уходят на /api/client-error,
				    а оттуда владельцу в Telegram (lib/reportError.ts). Здесь, а не в кабинете: так покрыты обе части сайта. */}
				<ErrorReporter />
			</body>
		</html>
	);
}
