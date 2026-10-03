import { JsonLd } from "@/lib/seo";
import { pageJsonLd } from "./metadata";
import { Footer, Navigation } from "@/components/website";
import Terms from "@/components/website/Terms/Terms";
import "react";

export { generateMetadata } from "./metadata";

export default function page({ params }: { params: { locale: string } }) {
	return (
		<div className="lg:max-w-screen-lg m-auto">
			<Navigation />
			<Terms />
			<JsonLd data={pageJsonLd(params.locale)} />
			<Footer />
		</div>
	);
}
