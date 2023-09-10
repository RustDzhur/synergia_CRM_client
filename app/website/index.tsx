import React from "react";
import MainPage from "./components/MainPage";
import Navigation from "./components/Navigation";
import Footer from "./components/Footer";

export default function WebSite() {
	return (
		<div className="lg:max-w-screen-lg m-auto">
			<Navigation/>
			<MainPage />
			<Footer/>
		</div>
	);
}
