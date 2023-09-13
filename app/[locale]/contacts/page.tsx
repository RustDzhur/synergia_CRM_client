import React from "react";
import ContactsPage from "../../../components/website/components/Contacts";
import { Footer, Navigation } from "../../../components/website";

export default function Contacts() {
	return (
		<div className="lg:max-w-screen-lg m-auto">
			<Navigation />
			<ContactsPage />
			<Footer />
		</div>
	);
}
