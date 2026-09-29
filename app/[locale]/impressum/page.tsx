import { Footer, Navigation } from "@/components/website";
import Impressum from "@/components/website/Impressum/Impressum";
import "react";

export default function page() {
	return (
		<div className="lg:max-w-screen-lg m-auto">
			<Navigation />
			<Impressum />
			<Footer />
		</div>
	);
}
