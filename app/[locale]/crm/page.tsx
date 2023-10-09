'use client'
import { Toaster } from "react-hot-toast";
import { Header, ModalNavigation, Sidebar } from "@/components/crm";
import { useRouter } from "next/navigation";
import useAuthStore from "@/app/store/useAuthStore";
import { useEffect } from "react";
import { useLanguageStore } from "@/app/store/useLanguageStore";

export default function Crm() {
	const { isSigningIn } = useAuthStore();
	const { selectedLanguage } = useLanguageStore();
	const router = useRouter();
	useEffect(() => {
		if (!isSigningIn) {
		  router.replace(`/${selectedLanguage.code}`);
		}
	  }, [isSigningIn, router, selectedLanguage.code]);
	
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
