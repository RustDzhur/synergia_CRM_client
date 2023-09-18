import "./styles/globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
	title: "Synergia CRM",
	description: "Synergia CRM for you and your Company",
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
		<html lang={locale}>
			<body className={inter.className}>
				<NextIntlClientProvider locale={locale} messages={messages}>
					{children}
				</NextIntlClientProvider>
			</body>
		</html>
	);
}
