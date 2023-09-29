import React from "react";
import dock from "../../../../../app/assets/images/dockPort.jpg";
import Logo from "@/components/crm/components/Header/components/Logo";

export default function RevolutionarySolution() {
	const backgroundImage = `url(${dock.src})`;

	return (
		<div
			className="bg-cover bg-no-repeat"
			style={{
				backgroundImage: `${backgroundImage}`,
				backgroundSize: "cover",
			}}>
			<div className="bg-[#000000] opacity-[0.88] px-12 py-50 flex flex-col items-center justify-center">
				<div className="mb-40">
					<Logo />
				</div>
				<p className="text-white font-bold text-24 leading-[1.7] tracking-[0.48px] text-center mb-40">
					We offer a revolutionary solution for your business
				</p>
			</div>
		</div>
	);
}
