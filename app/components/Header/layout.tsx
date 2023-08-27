import React from "react";
import BurgerMenu from "./components/BurgerMenu";
import Logo from "./components/Logo";
import Search from "./components/Search";
import SwitchCompany from "./components/SwitchCompany";
import SwitchLanguage from "./components/SwitchLanguage";
import Notification from "./components/Notification";
import CurrentUser from "./components/CurrentUser";

function Layout() {
	return (
		<div className="flex items-center justify-between">
			<div className="flex items-center justify-between lg:flex-row-reverse lg:justify-end">
				<Logo />
				<div className="lg:mr-30">
					<BurgerMenu />
				</div>
			</div>
			<div className="hidden lg:block">
				<Search />
			</div>
			<div className="hidden lg:block">
				<SwitchCompany />
			</div>
			<div className="hidden lg:block">
				<SwitchLanguage />
			</div>
			<div className="hidden lg:block">
				<Notification />
			</div>
			<div className="hidden lg:block">
				<CurrentUser />
			</div>
		</div>
	);
}

export default Layout;
