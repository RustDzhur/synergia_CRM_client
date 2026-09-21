import "./styles/globals.css";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
	title: "Firmspace CRM",
	description: "Firmspace CRM for you and your Company",
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
		// console.log(locale);
		
	} catch (error) {
		notFound();
	}

	return (
		<html lang={locale}>
			<body className={inter.className}>
				<NextIntlClientProvider locale={locale} messages={messages}>
					{children}
				</NextIntlClientProvider>
				{/* Vercel Web Analytics и Speed Insights: собирают данные только на развёрнутом сайте, после включения в панели Vercel */}
				<Analytics />
				<SpeedInsights />
			</body>
		</html>
	);
}
