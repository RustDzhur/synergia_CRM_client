import { Footer, Navigation } from "@/components/website";
import Careers from "@/components/website/components/Careers/Careers";
import React from "react";

export default function page() {
	return (
		<div className="lg:max-w-screen-lg m-auto">
			<Navigation />
			<Careers />
			<Footer />
		</div>
	);
}
