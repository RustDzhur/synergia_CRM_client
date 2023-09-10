import { Toaster } from "react-hot-toast";
import { Header } from "@/app/crm/components/Header";
import { ModalNavigation } from "@/app/crm/components/Modal";
import { Sidebar } from "@/app/crm/components/Sidebar";

export default function crm() {
	return (
		<>
			<header className="bg-headerBackground sm:px-12 sm:py-20 md:px-18 md:py-30 lg:px-32 lg:py-30 lg:max-w-screen-lg m-auto">
				<div>
					<Header />
				</div>
			</header>
			<aside className="lg:max-w-screen-lg m-auto">
				<Sidebar />
				<ModalNavigation />
			</aside>
			<main></main>
			<Toaster />
		</>
	);
}
