import React from "react";
import Hero from "./Hero/Hero";
import AboutUs from "./AboutUs/AboutUs";
import Advantages from "./Advantages/Advantages";
import WhatIsCrm from "./WhatIsCrm/WhatIsCrm";
import JoinUs from "./JoinUs/JoinUs";
import DiscoverCrm from "./DiscoverCrm/DiscoverCrm";
import PaidPlan from "./PaidPlan/PaidPlan";
import RevolutionarySolution from "./RevolutionarySolution/RevolutionarySolution";

export default function MainPage() {
	return (
		<div>
			<div className="sm:max-w-screen-sm md:max-w-screen-md lg:max-w-screen-lg lg:px-100 m-auto sm:px-12 md:px-20">
				<Hero />
			</div>
			<div className="relative sm:bg-aboutUsBackground md:p-20 sm:max-w-screen-sm md:bg-transparent md:max-w-screen-md lg:max-w-screen-lg lg:px-100 m-auto lg:pt-0 lg:pb-60 ">
				<AboutUs />
				<div className="absolute bg-gradient-background md:w-230 md:h-230 lg:w-303 lg:h-303  z-[-1] bottom-0 left-0 sm:hidden md:block"></div>
			</div>
      <div className="sm:max-w-screen-sm md:max-w-screen-md lg:max-w-screen-lg m-auto bg-advantages sm:px-12 sm:py-40 md:px-20 lg:px-100">
        <Advantages/>
      </div>
      <div className="sm:max-w-screen-sm md:max-w-screen-md lg:max-w-screen-lg m-auto sm:px-12 sm:py-40 md:px-20 lg:px-100 lg:tp-60 lg:pb-20">
        <WhatIsCrm/>
      </div>
      <div className="sm:max-w-screen-sm md:max-w-screen-md lg:max-w-screen-lg m-auto">
        <JoinUs/>
      </div>
      <div className="sm:max-w-screen-sm md:max-w-screen-md lg:max-w-screen-lg m-auto sm:px-12 sm:py-40 md:px-20 lg:px-100 lg:py-60">
        <DiscoverCrm/>
      </div>
      <div className="lg:max-w-screen-lg m-auto sm:px-12 sm:py-40 md:px-20 lg:px-100 lg:py-60">
        <PaidPlan/>
      </div>
      <div className="sm:max-w-screen-sm md:max-w-screen-md lg:max-w-screen-lg m-auto">
        <RevolutionarySolution/>
      </div>
		</div>
	);
}
