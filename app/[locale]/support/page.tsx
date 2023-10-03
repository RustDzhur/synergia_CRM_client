import { Footer, Navigation } from "@/components/website";
import Support from "@/components/website/components/Support/Support";
import React from "react";

export default function page() {
	return (
		<div className="lg:max-w-screen-lg m-auto">
			<Navigation />
			<Support />
			<Footer />
		</div>
	);
}
