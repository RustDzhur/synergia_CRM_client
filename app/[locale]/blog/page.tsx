import { JsonLd } from "@/lib/seo";
import { pageJsonLd } from "./metadata";
import "react";
import BlogPage from "@/components/website/Blog";
import { Footer, Navigation } from "../../../components/website";

export { generateMetadata } from "./metadata";

export default function Blog({ params }: { params: { locale: string } }) {
	return (
		<div className="lg:max-w-screen-lg m-auto">
			<Navigation />
			<BlogPage />
			<JsonLd data={pageJsonLd(params.locale)} />
			<Footer />
		</div>
	);
}
