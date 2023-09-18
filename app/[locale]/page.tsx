import { Navigation, MainPage, Footer } from "../../components/website";

export default function Home() {
	return (
		<div className="lg:max-w-screen-lg m-auto">
			<Navigation />
			<MainPage />
			<Footer />
		</div>
	);
}
