import React from "react";
import Logo from "./components/Logo";
import Search from "./components/Search";
import SwitchCompany from "./components/SwitchCompany";
import SwitchLanguage from "./components/SwitchLanguage";
import Notification from "./components/Notification";
import CurrentUser from "./components/CurrentUser";
import MobileMenu from "./components/MobileMenu";
import BurgerMenu from "../Sidebar/components/BurgerMenu";

// Раскладка из Figma (шапка 110px, отступы по краям 32px на desktop, 24px на tablet):
//  desktop: [≡ 40] 35 [Logo] 36 [Search 350] 30 [Switch Company 387] ...вправо... [Язык] 30 [🔔 25 Аватар Имя]
//  tablet:  [Logo] 54 [Search 300] ...вправо... [Имя ⌄] [🔔] [⋯]
//  mobile:  [Logo] ...вправо... [≡]   (всё остальное — внутри мобильного меню)
function Layout() {
	return (
		<div className="flex items-center w-full">
			<div className="flex items-center shrink-0 lg:gap-35">
				<div className="hidden lg:block">
					<BurgerMenu size={40} />
				</div>
				<Logo />
			</div>
			<div className="hidden md:block shrink-0 md:ml-[49px] lg:ml-[36px]">
				<Search />
			</div>
			<div className="hidden lg:block shrink-0 lg:ml-30 lg:w-[387px]">
				<SwitchCompany />
			</div>
			<div className="flex items-center ml-auto gap-30">
				<div className="hidden lg:block shrink-0">
					<SwitchLanguage />
				</div>
				<div className="hidden md:flex items-center gap-25 md:flex-row-reverse lg:flex-row">
					<Notification />
					<CurrentUser />
				</div>
				<div className="lg:hidden">
					<MobileMenu />
				</div>
			</div>
		</div>
	);
}

export default Layout;
