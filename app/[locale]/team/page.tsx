import { Footer, Navigation } from "@/components/website";
import Team from "@/components/website/Team/Team";
import "react";

export default function page() {
	return (
		<div className="lg:max-w-screen-lg m-auto">
			<Navigation />
			<Team />
			<Footer />
		</div>
	);
}
