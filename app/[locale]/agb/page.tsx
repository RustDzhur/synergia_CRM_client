import { Footer, Navigation } from "@/components/website";
import Terms from "@/components/website/Terms/Terms";
import "react";

export default function page() {
	return (
		<div className="lg:max-w-screen-lg m-auto">
			<Navigation />
			<Terms />
			<Footer />
		</div>
	);
}
