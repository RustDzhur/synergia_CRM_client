import { JsonLd } from "@/lib/seo";
import { pageJsonLd } from "./metadata";
import "react";
import ServicesPage from "../../../components/website/Services";
import { Footer, Navigation } from "../../../components/website";

export { generateMetadata } from "./metadata";

export default function Services({ params }: { params: { locale: string } }) {
	return (
		<div className="lg:max-w-screen-lg m-auto">
			<Navigation/>
			<ServicesPage />
			<JsonLd data={pageJsonLd(params.locale)} />
			<Footer/>
		</div>
	);
}
