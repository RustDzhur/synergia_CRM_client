import { Footer, Navigation } from "@/components/website";
import PrivacyPolicy from "@/components/website/PrivacyPolicy/PrivacyPolicy";
import "react";

export default function page() {
	return (
		<div className="lg:max-w-screen-lg m-auto">
			<Navigation />
			<PrivacyPolicy />
			<Footer />
		</div>
	);
}
