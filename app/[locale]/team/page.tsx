import { JsonLd } from "@/lib/seo";
import { pageJsonLd } from "./metadata";
import { Footer, Navigation } from "@/components/website";
import Team from "@/components/website/Team/Team";
import "react";

export { generateMetadata } from "./metadata";

export default function page({ params }: { params: { locale: string } }) {
	return (
		<div className="lg:max-w-screen-lg m-auto">
			<Navigation />
			<Team />
			<JsonLd data={pageJsonLd(params.locale)} />
			<Footer />
		</div>
	);
}
