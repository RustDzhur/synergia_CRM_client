import { JsonLd } from "@/lib/seo";
import { pageJsonLd } from "./metadata";
import { Footer, Navigation } from "@/components/website";
import Referral from "@/components/website/Referral/Referral";
import "react";

export { generateMetadata } from "./metadata";

export default function page({ params }: { params: { locale: string } }) {
	return (
		<div className="lg:max-w-screen-lg m-auto">
			<Navigation />
			<Referral />
			<JsonLd data={pageJsonLd(params.locale)} />
			<Footer />
		</div>
	);
}
