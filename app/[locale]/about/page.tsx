import React from "react";
import AboutUs from "../../../components/website/components/AboutUs";
import { Footer, Navigation } from "../../../components/website";

export default function About() {
	return (
		<div className="lg:max-w-screen-lg m-auto">
			<Navigation />
			<AboutUs />
			<Footer />
		</div>
	);
}
