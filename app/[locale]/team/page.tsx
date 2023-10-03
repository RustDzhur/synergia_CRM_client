import { Footer, Navigation } from "@/components/website";
import Team from "@/components/website/components/Team/Team";
import React from "react";

export default function page() {
	return (
		<div className="lg:max-w-screen-lg m-auto">
			<Navigation />
			<Team />
			<Footer />
		</div>
	);
}
