import { Footer, Navigation } from "@/components/website";
import Features from "@/components/website/components/Features/Features";
import React from "react";

export default function page() {
	return (
		<div className="lg:max-w-screen-lg m-auto">
			<Navigation />
			<Features />
			<Footer />
		</div>
	);
}
