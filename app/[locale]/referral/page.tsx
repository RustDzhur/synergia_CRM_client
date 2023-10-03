import { Footer, Navigation } from "@/components/website";
import Referral from "@/components/website/components/Referral/Referral";
import React from "react";

export default function page() {
	return (
		<div className="lg:max-w-screen-lg m-auto">
			<Navigation />
			<Referral />
			<Footer />
		</div>
	);
}
