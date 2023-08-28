import React from "react";
import Logo from "./components/Logo";
import Search from "./components/Search";
import SwitchCompany from "./components/SwitchCompany";
import SwitchLanguage from "./components/SwitchLanguage";
import Notification from "./components/Notification";
import CurrentUser from "./components/CurrentUser";
import MobileMenu from "./components/MobileMenu";

function Layout() {
	return (
		<div className="flex items-center justify-between">
			<div className="flex items-center justify-between md:flex-row-reverse md:justify-end">
				<Logo />
			</div>
			<div className="hidden md:block">
				<Search />
			</div>
			<div className="hidden lg:block">
				<SwitchCompany />
			</div>
			<div className="hidden lg:block">
				<SwitchLanguage />
			</div>
			<div className="hidden md:block">
				<Notification />
			</div>
			<div className="hidden md:block">
				<CurrentUser />
			</div>
			<div className=" lg:hidden">
				<MobileMenu />
			</div>
		</div>
	);
}

export default Layout;
