import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";

export default function Home() {
	return (
		<>
			<header className="bg-headerBackground sm:px-12 sm:py-20 md:px-18 md:py-30 lg:px-32 lg:py-30 lg:max-w-screen-lg m-auto">
				<div>
					<Header />
				</div>
			</header>
      <aside className="lg:max-w-screen-lg m-auto">
        <Sidebar/>
      </aside>
			<main>

      </main>
		</>
	);
}
