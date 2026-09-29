import { Footer, Navigation } from "@/components/website";
import Features from "@/components/website/Features/Features";
import "react";

export default function page() {
	return (
		<div className="lg:max-w-screen-lg m-auto">
			<Navigation />
			<Features />
			<Footer />
		</div>
	);
}
