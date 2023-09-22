import React from "react";

export default function JoinUs() {
	const contents = [
		{
			title: "Comprehensive Data",
			text: "Showcase the CRM dashboard&apos;s ability to provide comprehensive data insights and analytics.",
		},
		{
			title: "User-Friendly Interface",
			text: "Emphasize that the CRM dashboard offers an intuitive and user-friendly interface with highlight features",
		},
		{
			title: "Seamless Integration",
			text: "Highlight the CRM dashboard&apos;s capability to seamlessly integrate with other tools and platforms that the users might be using.",
		},
	];
	return (
		<div>
			<h1 className="text-center text-joinUsGrey sm:text-24 sm:mb-20 font-bold ">
				Why Join Us
			</h1>
			<div className="bg-joinUsPink sm:px-12 sm:py-30 md:p-20 lg:px-100 lg:py-50 text-white">
				{contents.map((content, index) => (
					<div key={index}>
						<h3>{content.title}</h3>
						<p>{content.text}</p>
					</div>
				))}
			</div>
		</div>
	);
}
