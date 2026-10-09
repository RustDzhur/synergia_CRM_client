import { JsonLd } from "@/lib/seo";
import { pageJsonLd } from "./metadata";
import { Footer, Navigation } from "@/components/website";
import Support from "@/components/website/Support/Support";
import "react";
import { priceTokens } from "@/lib/currencyServer";

export { generateMetadata } from "./metadata";

// Цены в ответах FAQ считаются на сервере по актуальному курсу и уходят готовыми строками
// (и в текст страницы, и в разметку FAQPage) — клиент курс не запрашивает и цена не «прыгает».
export default async function page({ params }: { params: { locale: string } }) {
	const prices = await priceTokens(params.locale);
	return (
		<div className="lg:max-w-screen-lg m-auto">
			<Navigation />
			<Support prices={prices} />
			<JsonLd data={await pageJsonLd(params.locale)} />
			<Footer />
		</div>
	);
}
