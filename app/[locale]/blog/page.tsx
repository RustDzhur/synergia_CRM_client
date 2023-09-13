import React from "react";
import BlogPage from "@/components/website/components/Blog";
import { Footer, Navigation } from "../../../components/website";

export default function Blog() {
	return (
		<div className="lg:max-w-screen-lg m-auto">
			<Navigation />
			<BlogPage />
			<Footer />
		</div>
	);
}
