import { Footer, Navigation } from "@/components/website";
import Documentation from "@/components/website/components/Documentation/Documentation";
import React from "react";

export default function page() {
	return (
		<div className="lg:max-w-screen-lg m-auto">
			<Navigation />
			<Documentation />
			<Footer />
		</div>
	);
}
