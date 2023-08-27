import React from "react";
import BurgerMenu from "./components/BurgerMenu";
import Logo from "./components/Logo";
import Search from "./components/Search";
import SwitchCompany from "./components/SwitchCompany";
import SwitchLanguage from "./components/SwitchLanguage";

function Layout() {
	return (
		<div className="flex items-center">
			<div className="flex items-center justify-between lg:flex-row-reverse lg:justify-end">
				<Logo />
				<BurgerMenu />
			</div>
			<div className="hidden lg:block">
				<Search />
			</div>
            <div className="hidden lg:block">
                <SwitchCompany/>
			</div>
            <div className="hidden lg:block">
                <SwitchLanguage/>
			</div>
		</div>
	);
}

export default Layout;
