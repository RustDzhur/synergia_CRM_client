import React from "react";
import AboutUs from "../website/components/AboutUs";
import { Footer, Navigation } from "../website";

export default function About() {
	return (
		<div className="lg:max-w-screen-lg m-auto">
			<Navigation />
			<AboutUs />
			<Footer />
		</div>
	);
}
