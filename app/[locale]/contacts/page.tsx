import { JsonLd } from "@/lib/seo";
import { pageJsonLd } from "./metadata";
import "react";
import ContactsPage from "../../../components/website/Contacts";
import { Footer, Navigation } from "../../../components/website";

export { generateMetadata } from "./metadata";

export default function Contacts({ params }: { params: { locale: string } }) {
	return (
		<div className="lg:max-w-screen-lg m-auto">
			<Navigation />
			<ContactsPage />
			<JsonLd data={pageJsonLd(params.locale)} />
			<Footer />
		</div>
	);
}
