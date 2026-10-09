import { JsonLd } from "@/lib/seo";
import { pageJsonLd } from "./metadata";
import { Footer, Navigation } from "@/components/website";
import Features from "@/components/website/Features/Features";
import "react";

export { generateMetadata } from "./metadata";

export default async function page({ params }: { params: { locale: string } }) {
	return (
		<div className="lg:max-w-screen-lg m-auto">
			<Navigation />
			<Features />
			<JsonLd data={await pageJsonLd(params.locale)} />
			<Footer />
		</div>
	);
}
