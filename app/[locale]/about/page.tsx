import { JsonLd } from "@/lib/seo";
import { pageJsonLd } from "./metadata";
import "react";
import AboutUs from "../../../components/website/AboutUs";
import { Footer, Navigation } from "../../../components/website";

export { generateMetadata } from "./metadata";

export default function About({ params }: { params: { locale: string } }) {
	return (
		<div className="lg:max-w-screen-lg m-auto">
			<Navigation />
			<AboutUs />
			<JsonLd data={pageJsonLd(params.locale)} />
			<Footer />
		</div>
	);
}
