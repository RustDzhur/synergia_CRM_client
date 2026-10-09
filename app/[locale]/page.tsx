import { JsonLd } from "@/lib/seo";
import { pageJsonLd } from "./metadata";
import { Navigation, MainPage, Footer } from "../../components/website";
import { getRates } from "@/lib/currencyServer";

export { generateMetadata } from "./metadata";

// Курс местной валюты берём на сервере и отдаём карточкам тарифов готовым: тогда в первом же HTML
// стоит «900 ₴» / «290 000 soʻm», а не евро, и цена не «прыгает» после гидратации.
export default async function Home({ params }: { params: { locale: string } }) {
	const rates = await getRates();
	return (
		<div className="lg:max-w-screen-lg m-auto">
			<Navigation />
			<MainPage rates={rates} />
			<div className="overflow-hidden">
				<JsonLd data={pageJsonLd(params.locale)} />
				<Footer slanted />
			</div>
		</div>
	);
}
