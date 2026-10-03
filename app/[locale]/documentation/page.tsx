import { JsonLd } from "@/lib/seo";
import { Footer, Navigation } from "@/components/website";
import { pageJsonLd } from "./metadata";
import Documentation from "@/components/website/Documentation/Documentation";
import { tx, type Lang } from "@/content/i18n";
import { DOCS } from "@/content/footerPages";
import { resolveDocs } from "@/content/docs/resolve";
import "react";

export { generateMetadata } from "./metadata";

// Названия кнопок и полей в тексте берутся из messages/{язык}.json на сервере: клиенту уходят готовые строки,
// а не все сообщения кабинета.
export default async function page({ params }: { params: { locale: string } }) {
	const locale = (["de", "en", "ua"].includes(params.locale) ? params.locale : "de") as Lang;
	const messages = (await import(`../../../messages/${locale}.json`)).default;
	const docs = {
		title: tx(DOCS.title, locale),
		intro: tx(DOCS.intro, locale),
		soon: tx(DOCS.soon, locale),
		sections: resolveDocs(DOCS.sections, locale, messages),
	};
	return (
		<div className="lg:max-w-screen-lg m-auto">
			<Navigation />
			<Documentation docs={docs} />
			<JsonLd data={pageJsonLd(params.locale)} />
			<Footer />
		</div>
	);
}
