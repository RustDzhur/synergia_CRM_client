import "./styles/globals.css";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";
import { loadMessages } from "@/lib/messages";
import ErrorReporter from "@/components/crm/shared/ErrorReporter";

const inter = Inter({ subsets: ["latin"] });

// Метаданные уровня сайта (metadataBase, языкозависимые title/description) — в layout.metadata.ts.
export { generateMetadata } from "./layout.metadata";

export default async function RootLayout({
	children,
	params: { locale } = { locale: "defaultLocale" },
}: {
	children: React.ReactNode;
	params?: { locale: string };
}) {
	let messages;
	try {		
		messages = await loadMessages(locale);
	} catch (error) {
		notFound();
	}

	return (
		<html lang={locale === "ua" ? "uk" : locale}>

			<body className={inter.className}>
				<NextIntlClientProvider locale={locale} messages={messages}>
					{children}
				</NextIntlClientProvider>
				{/* Исключения в браузере с любой страницы — и публичной, и кабинета — уходят на /api/client-error,
				    а оттуда владельцу в Telegram (lib/reportError.ts). Здесь, а не в кабинете: так покрыты обе части сайта. */}
				<ErrorReporter />
			</body>
		</html>
	);
}
