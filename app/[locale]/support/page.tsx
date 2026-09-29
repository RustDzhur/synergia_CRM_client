import { Footer, Navigation } from "@/components/website";
import Support from "@/components/website/Support/Support";
import "react";

export default function page() {
	return (
		<div className="lg:max-w-screen-lg m-auto">
			<Navigation />
			<Support />
			<Footer />
		</div>
	);
}
