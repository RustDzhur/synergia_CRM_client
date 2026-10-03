import { JsonLd } from "@/lib/seo";
import { pageJsonLd } from "./metadata";
import { Navigation, MainPage, Footer } from "../../components/website";

export { generateMetadata } from "./metadata";

export default function Home({ params }: { params: { locale: string } }) {
	return (
		<div className="lg:max-w-screen-lg m-auto">
			<Navigation />
			<MainPage />
			<div className="overflow-hidden">
				<JsonLd data={pageJsonLd(params.locale)} />
				<Footer slanted />
			</div>
		</div>
	);
}
