import { Toaster } from "react-hot-toast";
import { Header, ModalNavigation, Sidebar } from "@/components/crm";

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
