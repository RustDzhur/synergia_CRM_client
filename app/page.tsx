import Image from "next/image";
import { Header } from "./components/Header";
import logoMob from "./assets/images/logoMob.png";

export default function Home() {
	return (
		<>
			<header className="bg-headerBackground sm:px-12 sm:py-20 md:px-18 md:py-30 lg:px-32 lg:py-30">
				<div>
					<p className="text-primaryColor">Synergia CRM</p>
				</div>
				<Image src={logoMob} alt="logo" width={40} height={40} />
				<Header />
			</header>
			<main></main>
		</>
	);
}
