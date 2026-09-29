import "react";
import ServicesPage from "../../../components/website/Services";
import { Footer, Navigation } from "../../../components/website";

export default function Services() {
	return (
		<div className="lg:max-w-screen-lg m-auto">
			<Navigation/>
			<ServicesPage />
			<Footer/>
		</div>
	);
}
