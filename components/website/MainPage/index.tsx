import "react";
import Hero from "./Hero/Hero";
import AboutUs from "./AboutUs/AboutUs";
import Advantages from "./Advantages/Advantages";
import WhatIsCrm from "./WhatIsCrm/WhatIsCrm";
import JoinUs from "./JoinUs/JoinUs";
import DiscoverCrm from "./DiscoverCrm/DiscoverCrm";
import PaidPlan from "./PaidPlan/PaidPlan";
import RevolutionarySolution from "./RevolutionarySolution/RevolutionarySolution";
import Testimonials from "./Testimonials/Testimonials";

// rates — курсы валют с сервера (app/[locale]/page.tsx): карточки тарифов получают их сразу,
// первый HTML уже с ценой в валюте локали, без «прыжка» после гидратации.
export default function MainPage({ rates }: { rates?: Record<string, number> }) {
	return (
		<div>
			<div className="sm:max-w-screen-sm md:max-w-screen-md lg:max-w-screen-lg lg:px-100 m-auto sm:px-12 md:px-20">
				<Hero />
			</div>
			<div className="relative sm:bg-aboutUsBackground md:p-20 sm:max-w-screen-sm md:bg-transparent md:max-w-screen-md lg:max-w-screen-lg lg:px-100 m-auto lg:pt-0 lg:pb-60 ">
				<AboutUs />
				<div className="absolute bg-[linear-gradient(to_top_right,#C6FF4D,#5FBF3C)] md:w-230 md:h-230 lg:w-303 lg:h-303  z-[-1] bottom-0 left-0 sm:hidden md:block"></div>
			</div>
			<div className="sm:max-w-screen-sm md:max-w-screen-md lg:max-w-screen-lg m-auto bg-advantages sm:px-12 sm:py-40 md:px-20 md:py-20 lg:px-100 lg:py-50">
				<Advantages/>
			</div>
			{/* id нужен кнопке «Ablauf kennenlernen» в шапке — она прокручивает страницу сюда */}
			<div id="how-it-works" className="sm:max-w-screen-sm md:max-w-screen-md lg:max-w-screen-lg m-auto sm:px-12 sm:pt-40 sm:pb-[56px] md:pb-40 md:px-20 lg:px-100 lg:pt-[60px] lg:pb-[44px] scroll-mt-[90px]">
				<WhatIsCrm/>
			</div>
			<div className="sm:max-w-screen-sm md:max-w-screen-md lg:max-w-screen-lg m-auto">
				<JoinUs/>
			</div>
			<div className="sm:max-w-screen-sm md:max-w-screen-md lg:max-w-screen-lg m-auto sm:px-12 sm:py-40 md:px-20 lg:px-100 lg:pt-[120px] lg:pb-60">
				<DiscoverCrm/>
			</div>
			<div id="choose-plan" className="lg:max-w-screen-lg m-auto sm:px-12 sm:pt-[58px] sm:pb-[52px] md:px-20 md:pt-[32px] md:pb-[51px] lg:px-100 lg:pt-[48px] lg:pb-[80px] scroll-mt-[80px]">
				<PaidPlan rates={rates}/>
			</div>
			<div className="sm:max-w-screen-sm md:max-w-screen-md lg:max-w-screen-lg m-auto">
				<RevolutionarySolution/>
			</div>
			<div className="sm:max-w-screen-sm md:max-w-screen-md lg:max-w-screen-lg m-auto sm:px-12 sm:pt-[37px] sm:pb-[22px] md:px-20 md:pt-[27px] md:pb-[12px] lg:px-100 lg:pt-[45px] lg:pb-[37px]">
				<Testimonials/>
			</div>
		</div>
	);
}
