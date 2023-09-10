import React from "react";
import ContactsPage from "../website/components/Contacts";
import { Footer, Navigation } from "../website";

export default function Contacts() {
	return (
		<div className="lg:max-w-screen-lg m-auto">
			<Navigation />
			<ContactsPage />
			<Footer />
		</div>
	);
}
